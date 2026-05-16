#!/usr/bin/env node
/**
 * scripts/check-db.mjs
 *
 * Verifies the live Supabase project for Jarvis V1:
 *   1. .env.local is present + parseable
 *   2. The supabase URL is reachable
 *   3. accounts / transactions / monthly_snapshots tables exist
 *   4. Seed accounts are present
 *   5. RLS isn't blocking the publishable (anon) key from reading/writing
 *
 * Run: `npm run check:db`
 *
 * Exits non-zero if anything is missing so it can be used in CI/pre-deploy.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENV_PATH = resolve(process.cwd(), ".env.local");

function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed
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

async function main() {
  loadEnv();

  head("1. Environment");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    fail(".env.local missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  ok(`NEXT_PUBLIC_SUPABASE_URL=${url}`);
  ok(
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon.slice(0, 12)}…${anon.slice(-4)} (${
      anon.startsWith("sb_publishable_") ? "publishable" : "legacy JWT"
    })`,
  );
  if (service) ok(`SUPABASE_SERVICE_ROLE_KEY=${service.slice(0, 8)}…${service.slice(-4)} (set)`);
  else warn("SUPABASE_SERVICE_ROLE_KEY not set (only needed for future server writes)");

  const ref = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (ref) info(`Project ref: ${ref}`);

  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const adminClient = service
    ? createClient(url, service, { auth: { persistSession: false } })
    : null;

  head("2. Schema");
  const tables = ["accounts", "transactions", "monthly_snapshots"];
  const missing = [];
  for (const t of tables) {
    const { error, count } = await anonClient
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      if (
        error.message.includes("does not exist") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
      ) {
        fail(`Table public.${t} missing`);
        missing.push(t);
      } else {
        fail(`public.${t}: ${error.message} (code ${error.code ?? "?"})`);
        missing.push(t);
      }
    } else {
      ok(`public.${t} exists (rows: ${count ?? "?"})`);
    }
  }

  if (missing.length > 0) {
    head("Next step: apply the schema");
    console.log(
      `\nOpen the SQL editor for this project and paste the contents of ${c.cyan}supabase/schema.sql${c.reset}:\n`,
    );
    if (ref) {
      console.log(
        `  ${c.bold}https://supabase.com/dashboard/project/${ref}/sql/new${c.reset}\n`,
      );
    }
    console.log("Then re-run:  npm run check:db\n");
    process.exit(1);
  }

  head("3. Seed accounts");
  const { data: accounts, error: accErr } = await anonClient
    .from("accounts")
    .select("id, name, type")
    .order("name", { ascending: true });
  if (accErr) {
    fail(`Could not read accounts: ${accErr.message}`);
    process.exit(1);
  }
  if (!accounts || accounts.length === 0) {
    warn(
      "accounts table is empty — schema.sql normally seeds 7 accounts. Re-run the seed block from supabase/schema.sql, or add accounts via the app.",
    );
  } else {
    ok(`${accounts.length} accounts present`);
    for (const a of accounts) console.log(`   ${c.dim}- ${a.name} (${a.type})${c.reset}`);
  }

  head("4. RLS / write check (anon)");
  const sentinel = `__jarvis_check_${Date.now()}`;
  const insertPayload = {
    date: new Date().toISOString().slice(0, 10),
    merchant: sentinel,
    amount: 0.01,
    type: "expense",
    category: "Misc",
    account_id: accounts && accounts[0] ? accounts[0].id : null,
    notes: "automated check — safe to delete",
  };
  const { data: ins, error: insErr } = await anonClient
    .from("transactions")
    .insert(insertPayload)
    .select()
    .single();

  if (insErr) {
    fail(`Anon insert failed: ${insErr.message}`);
    console.log(
      `\n${c.yellow}This usually means RLS is enabled but no policies are defined.${c.reset}`,
    );
    console.log(
      "Run this in the SQL editor (V1 has no auth, so RLS must stay off):\n",
    );
    console.log(
      `  ${c.cyan}alter table public.accounts          disable row level security;`,
    );
    console.log(`  alter table public.transactions      disable row level security;`);
    console.log(
      `  alter table public.monthly_snapshots disable row level security;${c.reset}\n`,
    );
    process.exit(1);
  }
  ok(`Anon insert succeeded (id ${ins.id})`);

  const { error: delErr } = await anonClient
    .from("transactions")
    .delete()
    .eq("merchant", sentinel);
  if (delErr) {
    warn(`Could not clean up sentinel row: ${delErr.message}`);
  } else {
    ok("Anon delete succeeded (sentinel row removed)");
  }

  if (adminClient) {
    const { error: adminErr } = await adminClient
      .from("transactions")
      .select("id", { count: "exact", head: true });
    if (adminErr) warn(`Service-role read failed: ${adminErr.message}`);
    else ok("Service-role key validated");
  }

  head("Result");
  ok(
    "Supabase is live and Jarvis can read + write through the publishable key.",
  );
  console.log(`\nNext: ${c.bold}npm run dev${c.reset} and look for the "Connected to Supabase" pill.\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}Unexpected error:${c.reset}`, err);
  process.exit(1);
});
