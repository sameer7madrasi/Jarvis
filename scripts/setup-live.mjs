#!/usr/bin/env node
/**
 * scripts/setup-live.mjs
 *
 * Interactive helper that takes Capital OS from "schema applied but RLS on"
 * to a fully working live V1 by:
 *
 *   1. Detecting RLS / seed issues against the live project
 *   2. Printing the exact SQL to paste in the Supabase SQL editor + the link
 *   3. Polling Supabase every 3s until the fix lands
 *   4. Running an end-to-end smoke test (insert income/expense/investment, read, delete)
 *
 * Run: `npm run setup:live`
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENV_PATH = resolve(process.cwd(), ".env.local");

function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};
const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}!${c.reset} ${m}`);
const fail = (m) => console.log(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}›${c.reset} ${m}`);
const head = (m) => console.log(`\n${c.bold}${m}${c.reset}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(anon, admin) {
  // Detect status of RLS + seed. Uses admin to bypass RLS for ground-truth row counts.
  const out = { tables: {}, rlsOk: false, seeded: false, accountId: null, error: null };
  for (const t of ["accounts", "transactions", "monthly_snapshots"]) {
    const { error } = await anon.from(t).select("*", { head: true, count: "exact" });
    out.tables[t] = error ? error.message : "ok";
  }

  // Real account count via admin
  if (admin) {
    const { data, error } = await admin.from("accounts").select("id").limit(1);
    if (!error && data && data.length > 0) {
      out.seeded = true;
      out.accountId = data[0].id;
    }
  } else {
    const { data, error } = await anon.from("accounts").select("id").limit(1);
    if (!error && data && data.length > 0) {
      out.seeded = true;
      out.accountId = data[0].id;
    }
  }

  // Anon write probe with unique sentinel
  const sentinel = `__capitalos_probe_${Date.now()}`;
  const { error: insErr } = await anon
    .from("transactions")
    .insert({
      date: new Date().toISOString().slice(0, 10),
      merchant: sentinel,
      amount: 0.01,
      type: "expense",
      category: "Misc",
      account_id: out.accountId,
      notes: "probe — safe to delete",
    });
  if (!insErr) {
    out.rlsOk = true;
    await anon.from("transactions").delete().eq("merchant", sentinel);
  } else {
    out.error = insErr.message;
  }
  return out;
}

async function smokeTest(anon, accountId) {
  head("Smoke test");
  const tag = `capitalos-smoke-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const rows = [
    {
      date: today,
      merchant: "Smoke Test Salary",
      amount: 5000,
      type: "income",
      category: "Salary",
      account_id: accountId,
      notes: tag,
    },
    {
      date: today,
      merchant: "Smoke Test Rent",
      amount: 2000,
      type: "expense",
      category: "Rent",
      account_id: accountId,
      notes: tag,
    },
    {
      date: today,
      merchant: "Smoke Test Roth IRA",
      amount: 500,
      type: "investment",
      category: "Roth IRA",
      account_id: accountId,
      notes: tag,
    },
  ];

  info("Inserting 1 income, 1 expense, 1 investment via the publishable key…");
  const { data: ins, error: insErr } = await anon
    .from("transactions")
    .insert(rows)
    .select();
  if (insErr) {
    fail(`Insert failed: ${insErr.message}`);
    return false;
  }
  ok(`Inserted ${ins.length} rows`);
  for (const r of ins) console.log(`   ${c.dim}- ${r.type.padEnd(10)} ${r.merchant} $${r.amount}${c.reset}`);

  info("Reading them back…");
  const { data: read, error: readErr } = await anon
    .from("transactions")
    .select("id, type, merchant, amount")
    .eq("notes", tag);
  if (readErr) {
    fail(`Read failed: ${readErr.message}`);
    return false;
  }
  if (!read || read.length !== 3) {
    fail(`Expected 3 rows, got ${read?.length ?? 0}`);
    return false;
  }
  ok(`Read back ${read.length} rows`);

  info("Cleaning up smoke-test rows…");
  const { error: delErr } = await anon.from("transactions").delete().eq("notes", tag);
  if (delErr) {
    warn(`Cleanup failed (rows remain in DB tagged "${tag}"): ${delErr.message}`);
    return true;
  }
  ok("Smoke-test rows deleted");
  return true;
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) {
    fail(".env.local missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  const ref = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

  head("Probing live Supabase project");
  let status = await probe(anon, admin);

  const tablesOk = Object.values(status.tables).every((v) => v === "ok");
  if (!tablesOk) {
    fail("Some tables aren't accessible:");
    for (const [t, v] of Object.entries(status.tables)) {
      console.log(`   ${v === "ok" ? c.green + "✓" : c.red + "✗"}${c.reset} ${t}: ${v}`);
    }
    console.log(
      `\nApply ${c.cyan}supabase/schema.sql${c.reset} in the SQL editor first, then re-run.\n`,
    );
    process.exit(1);
  }

  if (status.rlsOk && status.seeded) {
    ok("RLS off, accounts seeded — ready for smoke test.");
  } else {
    head("Action required: paste this SQL into your Supabase SQL editor");
    if (ref) {
      console.log(
        `${c.cyan}https://supabase.com/dashboard/project/${ref}/sql/new${c.reset}\n`,
      );
    }
    const fixSql = readFileSync(
      resolve(process.cwd(), "supabase/fix-rls-and-seed.sql"),
      "utf8",
    );
    console.log("```sql");
    console.log(fixSql.trim());
    console.log("```\n");
    if (!status.rlsOk) warn(`Anon writes blocked: ${status.error}`);
    if (!status.seeded) warn("accounts table appears empty.");
    info("Polling every 3s — waiting for you to run the SQL above…");

    const start = Date.now();
    while (Date.now() - start < 10 * 60 * 1000) {
      await sleep(3000);
      status = await probe(anon, admin);
      if (status.rlsOk && status.seeded) {
        ok("Detected fix-up applied.");
        break;
      }
      process.stdout.write(".");
    }
    if (!status.rlsOk || !status.seeded) {
      console.log("");
      fail("Timed out waiting for SQL fix-up. Re-run `npm run setup:live` after applying it.");
      process.exit(1);
    }
  }

  const accountId = status.accountId;
  if (!accountId) {
    fail("No accounts to attach test transactions to.");
    process.exit(1);
  }

  const passed = await smokeTest(anon, accountId);
  if (!passed) {
    fail("Smoke test failed. See errors above.");
    process.exit(1);
  }

  head("Result");
  ok("Capital OS is live: schema applied, RLS configured, anon read+write proven.");
  console.log(
    `\nNext: ${c.bold}npm run dev${c.reset} and look for the "Connected to Supabase" pill.\n`,
  );
}

main().catch((err) => {
  console.error(`\n${c.red}Unexpected error:${c.reset}`, err);
  process.exit(1);
});
