#!/usr/bin/env node
/**
 * scripts/check-banks.mjs
 *
 * Verifies Phase 3 (bank sync) setup end-to-end:
 *   1. `.env` then `.env.local` in the project root are merged (same idea as
 *      Next.js); non-empty file values always apply so empty shell exports
 *      cannot shadow your secrets.
 *   2. JARVIS_ENCRYPTION_KEY is a valid 32-byte hex string + round-trips
 *   3. Supabase schema_v3 tables/columns exist (linked_items + the
 *      external_id columns on transactions / holdings)
 *   4. The configured Plaid env answers /institutions/get for Bank of America
 *
 * Run: `npm run check:banks`
 * Exits non-zero on the first hard failure.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(__filename);

/** Repo root: directory that contains `package.json`, walking up from `scripts/`. */
function findPackageRoot() {
  let dir = SCRIPT_DIR;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "package.json"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const ROOT = findPackageRoot();

/** Parse KEY=value lines into an object (first `=` separates key from value). */
function parseEnvLines(raw) {
  const out = {};
  const text = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    if (!k) continue;
    const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    out[k] = v;
  }
  return out;
}

/**
 * Merge `.env` then `.env.local` (later wins). Apply every non-empty value to
 * `process.env` so (a) vars can live in either file like Next.js, and (b) an
 * empty `export PLAID_SECRET=` in the shell does not block loading from disk.
 */
function loadProjectEnv() {
  const merged = {};
  let foundFile = false;
  for (const name of [".env", ".env.local"]) {
    const p = resolve(ROOT, name);
    if (!existsSync(p)) continue;
    foundFile = true;
    Object.assign(merged, parseEnvLines(readFileSync(p, "utf8")));
  }
  if (!foundFile) {
    console.warn(
      "\nNo .env or .env.local found next to package.json. Expected one of:\n  " +
        resolve(ROOT, ".env.local") +
        "\n  " +
        resolve(ROOT, ".env") +
        "\n",
    );
  }
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null && String(v).length > 0) {
      process.env[k] = String(v);
    }
  }
}

const c = {
  reset: "\x1b[0m",
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

let hardFail = false;

async function main() {
  loadProjectEnv();

  // --- 1. Env ----------------------------------------------------------
  head("1. Environment variables");
  const requiredEnv = ["PLAID_CLIENT_ID", "PLAID_SECRET", "JARVIS_ENCRYPTION_KEY"];
  const optionalEnv = ["PLAID_ENV", "PLAID_REDIRECT_URI", "PLAID_WEBHOOK_URL"];
  let envOk = true;
  for (const key of requiredEnv) {
    if (process.env[key]) ok(`${key} present`);
    else {
      fail(`${key} missing`);
      envOk = false;
    }
  }
  for (const key of optionalEnv) {
    if (process.env[key]) info(`${key} = ${key === "PLAID_ENV" ? process.env[key] : "set"}`);
    else warn(`${key} not set (optional)`);
  }
  if (!envOk) {
    info(`Project root (for .env files): ${ROOT}`);
    const localPath = resolve(ROOT, ".env.local");
    if (existsSync(localPath)) {
      const raw = readFileSync(localPath, "utf8");
      if (!/PLAID_CLIENT_ID\s*=/m.test(raw)) {
        info(
          ".env.local exists on disk but has no PLAID_CLIENT_ID — if you pasted keys in the editor, save the file (e.g. Cmd+S) and run again.",
        );
      }
    } else {
      info(`No .env.local at ${localPath} — create it from .env.example and add Plaid + JARVIS_ENCRYPTION_KEY.`);
    }
  }
  if (!envOk) hardFail = true;

  // --- 2. Encryption ---------------------------------------------------
  head("2. JARVIS_ENCRYPTION_KEY");
  if (process.env.JARVIS_ENCRYPTION_KEY) {
    try {
      const key = Buffer.from(process.env.JARVIS_ENCRYPTION_KEY, "hex");
      if (key.length !== 32) {
        fail(`expected 32 bytes (64 hex chars); got ${key.length} bytes`);
        hardFail = true;
      } else {
        // Round-trip a sample blob
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const enc = Buffer.concat([cipher.update("hello jarvis", "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const round = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
        if (round === "hello jarvis") ok("AES-256-GCM round-trip works");
        else {
          fail("AES round-trip mismatch");
          hardFail = true;
        }
      }
    } catch (err) {
      fail(`could not parse key: ${err.message}`);
      hardFail = true;
    }
  } else {
    info(
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  // --- 3. Supabase schema ----------------------------------------------
  head("3. Supabase schema (linked_items + external_id columns)");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    warn("Supabase env not set — skipping schema check");
  } else {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    try {
      const { error } = await sb.from("linked_items").select("id", { count: "exact", head: true });
      if (error && /relation/i.test(error.message)) {
        fail("linked_items table missing — run supabase/schema_v3.sql then supabase/fix-v3-rls.sql in the Supabase SQL editor");
        hardFail = true;
      } else if (error) {
        fail(`linked_items query failed: ${error.message}`);
        hardFail = true;
      } else {
        ok("linked_items table exists");
      }

      const lastErrProbe = await sb.from("linked_items").select("last_error").limit(1);
      if (lastErrProbe.error) {
        fail(
          `linked_items.last_error column missing — run supabase/fix-v3-rls.sql in Supabase SQL Editor (${lastErrProbe.error.message})`,
        );
        hardFail = true;
      } else {
        ok("linked_items.last_error column exists");
      }
    } catch (err) {
      fail(`Supabase connection failed: ${err.message}`);
      hardFail = true;
    }

    for (const [table, col] of [
      ["transactions", "external_id"],
      ["holdings", "external_id"],
      ["accounts", "provider_account_id"],
    ]) {
      try {
        const { error } = await sb.from(table).select(col).limit(1);
        if (error) {
          fail(`${table}.${col} missing or unreadable — re-run supabase/schema_v3.sql`);
          hardFail = true;
        } else {
          ok(`${table}.${col} exists`);
        }
      } catch (err) {
        fail(`${table}.${col} probe failed: ${err.message}`);
        hardFail = true;
      }
    }
  }

  // --- 4. Plaid sanity ping --------------------------------------------
  head("4. Plaid /institutions/get sanity ping");
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    warn("Plaid env not set — skipping ping");
  } else {
    const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
    const base =
      env === "production" ? "https://production.plaid.com" : "https://sandbox.plaid.com";
    try {
      const res = await fetch(`${base}/institutions/get`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.PLAID_CLIENT_ID,
          secret: process.env.PLAID_SECRET,
          count: 1,
          offset: 0,
          country_codes: ["US"],
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.institutions?.length) {
        ok(`Plaid ${env}: ${json.institutions[0].name} (and ${json.total ?? "many"} more)`);
      } else if (res.status === 400 && /INVALID_API_KEYS|INVALID_SECRET|INVALID_CLIENT_ID/i.test(JSON.stringify(json))) {
        fail(`Plaid rejected credentials for env=${env}: ${json?.error_message ?? json?.error_code}`);
        hardFail = true;
      } else {
        fail(`Plaid ping failed (HTTP ${res.status}): ${json?.error_message ?? JSON.stringify(json)?.slice(0, 200)}`);
        hardFail = true;
      }
    } catch (err) {
      fail(`Plaid ping threw: ${err.message}`);
      hardFail = true;
    }
  }

  head("Summary");
  if (hardFail) {
    fail("Some checks failed. See above; bank sync will not work until they pass.");
    process.exit(1);
  } else {
    ok("Bank sync is ready to go. Open the Money dashboard and click 'Connect bank'.");
  }
}

main().catch((err) => {
  fail(`check-banks crashed: ${err.message}`);
  process.exit(1);
});
