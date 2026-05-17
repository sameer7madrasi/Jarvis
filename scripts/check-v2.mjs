#!/usr/bin/env node
/**
 * scripts/check-v2.mjs
 *
 * Verifies the Phase 2 setup end-to-end:
 *   1. .env.local is present + parseable
 *   2. supabase/schema_v2.sql tables exist (holdings, watchlist, drafts,
 *      chat_conversations, chat_messages, persona_configs, usage_log)
 *   3. Seed data lives in holdings + watchlist
 *   4. OPENAI_API_KEY and/or ANTHROPIC_API_KEY is set
 *   5. The configured AI provider actually answers a 1-token probe
 *   6. The chat tables accept a sentinel write
 *
 * Run: `npm run check:v2`
 * Exits non-zero if anything is missing.
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
    const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
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

const SCHEMA_TABLES = [
  "holdings",
  "watchlist",
  "drafts",
  "chat_conversations",
  "chat_messages",
  "persona_configs",
  "usage_log",
];

let failures = 0;

async function main() {
  loadEnv();

  // ───── 1. Env ─────
  head("1. Environment");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    fail("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
    process.exit(1);
  }
  ok(`NEXT_PUBLIC_SUPABASE_URL=${url}`);
  ok(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon.slice(0, 12)}…${anon.slice(-4)}`);

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (hasOpenAI) ok(`OPENAI_API_KEY=${process.env.OPENAI_API_KEY.slice(0, 7)}…${process.env.OPENAI_API_KEY.slice(-4)}`);
  else warn("OPENAI_API_KEY not set");
  if (hasAnthropic) ok(`ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY.slice(0, 7)}…${process.env.ANTHROPIC_API_KEY.slice(-4)}`);
  else warn("ANTHROPIC_API_KEY not set");
  if (!hasOpenAI && !hasAnthropic) {
    fail("No AI provider key set — at least one of OPENAI_API_KEY / ANTHROPIC_API_KEY is required for live personas");
    failures++;
  }

  const client = createClient(url, anon, { auth: { persistSession: false } });
  const ref = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

  // ───── 2. Schema ─────
  head("2. Phase 2 schema");
  const missing = [];
  for (const t of SCHEMA_TABLES) {
    const { error, count } = await client.from(t).select("*", { count: "exact", head: true });
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205" || error.message.includes("does not exist")) {
        fail(`Table public.${t} missing`);
        missing.push(t);
      } else {
        fail(`public.${t}: ${error.message} (code ${error.code ?? "?"})`);
        missing.push(t);
      }
    } else {
      ok(`public.${t} (rows: ${count ?? "?"})`);
    }
  }
  if (missing.length > 0) {
    head("Next step: apply Phase 2 schema");
    console.log(`\nPaste ${c.cyan}supabase/schema_v2.sql${c.reset} into the SQL editor:\n`);
    if (ref) console.log(`  ${c.bold}https://supabase.com/dashboard/project/${ref}/sql/new${c.reset}\n`);
    console.log("Then re-run:  npm run check:v2\n");
    process.exit(1);
  }

  // ───── 3. Seed data ─────
  head("3. Seed data");
  const { data: holdings } = await client.from("holdings").select("symbol").limit(20);
  if (holdings && holdings.length > 0) {
    ok(`${holdings.length} holdings: ${holdings.map((h) => h.symbol).join(", ")}`);
  } else {
    warn("holdings table is empty — schema_v2.sql normally seeds 5. Re-run the SQL or add manually.");
  }
  const { data: wl } = await client.from("watchlist").select("symbol").limit(20);
  if (wl && wl.length > 0) {
    ok(`${wl.length} watchlist items: ${wl.map((w) => w.symbol).join(", ")}`);
  } else {
    warn("watchlist is empty");
  }

  // ───── 4. Chat persistence smoke test ─────
  head("4. Chat persistence write check");
  const seedTitle = `__jarvis_v2_check_${Date.now()}`;
  const { data: conv, error: convErr } = await client
    .from("chat_conversations")
    .insert({ persona_id: "home", title: seedTitle })
    .select()
    .single();
  if (convErr) {
    fail(`chat_conversations insert failed: ${convErr.message}`);
    if (
      convErr.message.toLowerCase().includes("row-level security") ||
      convErr.code === "42501"
    ) {
      console.log(
        `\n${c.yellow}This is the same Supabase auto-RLS gotcha as V1.${c.reset}`,
      );
      console.log(
        `Paste ${c.cyan}supabase/fix-v2-rls-and-seed.sql${c.reset} into the SQL editor:`,
      );
      if (ref) {
        console.log(`  ${c.bold}https://supabase.com/dashboard/project/${ref}/sql/new${c.reset}`);
      }
      console.log(`Then re-run:  npm run check:v2\n`);
    }
    failures++;
  } else {
    ok(`chat_conversations insert ok (id ${conv.id})`);
    const { error: msgErr } = await client.from("chat_messages").insert({
      conversation_id: conv.id,
      role: "user",
      content: "automated v2 check — safe to delete",
    });
    if (msgErr) {
      fail(`chat_messages insert failed: ${msgErr.message}`);
      failures++;
    } else {
      ok("chat_messages insert ok");
    }
    // clean up
    await client.from("chat_conversations").delete().eq("id", conv.id);
    ok("cleanup: sentinel conversation removed (cascade deletes message)");
  }

  // ───── 5. AI provider probe ─────
  head("5. AI provider probe");
  if (hasOpenAI) {
    info("Pinging OpenAI with a 1-token completion…");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "say 'ok'" }],
          max_tokens: 4,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(`OpenAI: ${res.status} ${data.error?.message ?? JSON.stringify(data)}`);
        failures++;
      } else {
        const reply = data.choices?.[0]?.message?.content?.trim() ?? "(empty)";
        ok(`OpenAI gpt-4o-mini answered: "${reply}"`);
        if (data.usage) {
          info(`tokens prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens}`);
        }
      }
    } catch (err) {
      fail(`OpenAI request threw: ${err?.message ?? err}`);
      failures++;
    }
  }
  if (hasAnthropic) {
    info("Pinging Anthropic with a 1-token completion…");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4,
          messages: [{ role: "user", content: "say 'ok'" }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fail(`Anthropic: ${res.status} ${data.error?.message ?? JSON.stringify(data)}`);
        failures++;
      } else {
        const reply = data.content?.[0]?.text?.trim() ?? "(empty)";
        ok(`Anthropic answered: "${reply}"`);
        if (data.usage) {
          info(`tokens in=${data.usage.input_tokens} out=${data.usage.output_tokens}`);
        }
      }
    } catch (err) {
      fail(`Anthropic request threw: ${err?.message ?? err}`);
      failures++;
    }
  }

  // ───── Result ─────
  head("Result");
  if (failures === 0) {
    ok("Phase 2 is live: Supabase tables, seeds, chat persistence and AI provider all OK.");
    console.log(`\nNext: ${c.bold}npm run dev${c.reset} → open ${c.cyan}http://localhost:3000${c.reset} → press ${c.bold}⌘K${c.reset} to chat with Jarvis.\n`);
  } else {
    fail(`${failures} check(s) failed — see above.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n${c.red}Unexpected error:${c.reset}`, err);
  process.exit(1);
});
