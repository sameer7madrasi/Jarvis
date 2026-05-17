# Jarvis — Financial Storyteller

Jarvis is a personal capital-allocation cockpit built around the **"A Million by 30"** goal, now with two configurable AI personas on top of the original V1 dashboard:

- **JarvisHome** — your good-buddy copilot for personal finances. Talks to the same transactions you enter, your goals, and your spending shape.
- **JarvisFinance** — your markets + research blood brother. Pulls live quotes, fundamentals and news against your portfolio + watchlist, and ghost-writes article drafts.

V1 was the dashboard. **V2 is the storyteller** — the same dark, premium UI, plus chat (drawer + full-page), a sidebar nav, and a drafts workspace.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with a custom dark palette
- **Supabase / Postgres** for persistence (mock-data fallback when env vars are missing)
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/react`) for provider-agnostic streaming + tool calling
- **yahoo-finance2** for free market data (Polygon stub included)
- **Recharts** + **react-markdown** + **lucide-react** for visualization

## What ships in V2

### Phase 2A — JarvisHome (personal copilot)

- Provider-agnostic AI layer in `lib/ai/` — picks OpenAI vs Anthropic per-persona, with offline fallback when no key is set.
- Persona registry in `lib/personas/` — `home` + `finance` with system prompts, allow-listed tools, default models, and color identities.
- JarvisHome tools in `lib/tools/transactions.ts` — `list_transactions`, `monthly_summary`, `top_categories`, `goal_progress`, `list_accounts`. All wrap the existing `lib/analytics.ts` + `lib/data.ts` primitives so the AI sees real data, not stubs.
- Streaming chat endpoint at `app/api/chat/route.ts` with per-persona tool allow-listing and auto-persistence.
- Chat UI: `ChatPanel`, `ChatMessage`, `ChatInput`, `ToolCallChip`, `PersonaAvatar`, `CostChip` — themed to match the dashboard.
- Cmd+K-triggered `ChatDrawer` overlays any page; persona switcher built-in.
- Full-page experience at `/home` with a left rail of past conversations.
- Chat persistence in `chat_conversations` + `chat_messages` so threads survive reloads.

### Phase 2B — JarvisFinance (markets + research)

- New tables: `holdings`, `watchlist`, `drafts` (Supabase) plus realistic in-memory mocks.
- Market data layer in `lib/market/` with a `MarketDataProvider` interface, Yahoo Finance default, and a `polygon` stub for the upgrade path.
- Server-side market proxy at `app/api/market/route.ts` so paid-provider keys never reach the client.
- JarvisFinance tools: `list_holdings`, `portfolio_value`, `position_pnl`, `list_watchlist`, `add_to_watchlist`, `get_quote`, `get_history`, `get_news`, `list_drafts`, `create_draft`, `append_to_draft`.
- Full-page `/finance` with Portfolio / Watchlist / Drafts widgets on the left rail and JarvisFinance chat on the right.

### Phase 2C — Drafts workspace

- `/finance/drafts` index page and `/finance/drafts/[slug]` editor.
- Side-by-side markdown source + rendered preview with autosave.
- One-click "Ask JarvisFinance" launcher that opens the chat drawer pre-set to the finance persona.

### Cross-cutting polish

- Sidebar nav (`Money` / `JarvisHome` / `JarvisFinance` + Drafts + Personas).
- `/settings/personas` shows provider status, model, allowed tools, and the full system prompt per persona.
- `usage_log` table + per-reply token accounting via the chat route's `onFinish`.
- Mock-data fallback for every new table — the app stays demo-able with no Supabase, no AI key, no market provider.

### Phase 3 — Bank sync (Plaid + CSV)

- **Plaid Link** for one-click OAuth into Bank of America (and every US institution Plaid supports). OAuth completes on [`app/banks/return/page.tsx`](./app/banks/return/page.tsx). Set `PLAID_REDIRECT_URI` to an **HTTPS** URL ending in `/banks/return` (Production Plaid does not allow `http://localhost`; use ngrok or a deployed host).
- **Read-only Plaid posture:** Link requests **transactions** + **investments** only (no Plaid Auth ACH numbers, no payments/transfers). The server only calls read-style Plaid endpoints plus `item/remove` on disconnect. See [Plaid read-only posture](#plaid-read-only-posture) below.
- New table `linked_items` holds each institution login. Access tokens are AES-256-GCM encrypted (`lib/banks/encryption.ts`) using `JARVIS_ENCRYPTION_KEY` before they ever touch the database.
- `lib/banks/sync.ts` pulls **transactions** via `/transactions/sync` (cursor-based, incremental), **holdings** via `/investments/holdings/get`, and accounts via `/accounts/get`. Plaid's Personal Finance Category taxonomy is collapsed to the Jarvis categories in `lib/banks/categories.ts`.
- **Webhook** at `/api/banks/webhook` verifies Plaid's signed JWT (ES256) and re-triggers sync on `SYNC_UPDATES_AVAILABLE`, `HOLDINGS:DEFAULT_UPDATE`, `ITEM:ERROR`, `ITEM:LOGIN_REQUIRED`.
- **CSV fallback** parser (`lib/banks/csv.ts`) handles Bank of America's actual export plus any Date/Description/Amount table. Same `external_id` dedupe pattern as Plaid (`csv:<accountId>:<date>:<cents>:<normalized-description>`).
- New **JarvisHome tools** `list_linked_accounts` and `sync_bank_accounts` so the assistant can pull fresh data on demand.
- "Connections" card on the Money dashboard surfaces linked institutions, last-synced time, status (`active` / `login_required` / `error`), plus "Sync now" + "Disconnect" actions.
- `npm run check:banks` verifies the env, the v3 schema, the encryption key round-trips, and that Plaid answers `/institutions/get`.

## Folder structure

```
.
├── app/
│   ├── api/
│   │   ├── banks/                     # link-token, exchange, sync, webhook, csv, items
│   │   ├── chat/route.ts              # Streaming chat (tool loop)
│   │   ├── conversations/route.ts     # List threads / messages
│   │   ├── drafts/[slug]/route.ts     # GET / PATCH a draft
│   │   └── market/route.ts            # Server-side market proxy
│   ├── finance/
│   │   ├── drafts/[slug]/page.tsx     # Drafts editor
│   │   ├── drafts/page.tsx            # Drafts index
│   │   └── page.tsx                   # JarvisFinance shell
│   ├── home/page.tsx                  # JarvisHome shell
│   ├── banks/return/page.tsx          # Plaid OAuth redirect completion (production BoA)
│   ├── settings/personas/page.tsx     # Persona settings
│   ├── layout.tsx                     # Root + AppShell
│   └── page.tsx                       # Money dashboard (V1)
├── components/
│   ├── AppShell.tsx, Sidebar.tsx, Dashboard.tsx, MetricCard.tsx, …  # V1 + nav
│   ├── banks/                         # LinkBankButton, LinkedAccountsList, CsvImporter, plaidExchangeFlow
│   ├── chat/                          # ChatPanel/Message/Input/Drawer/Page/Avatar/CostChip/ToolCallChip
│   └── finance/                       # PortfolioTable, WatchlistCard, DraftList, DraftEditor
├── lib/
│   ├── ai/                            # provider.ts, cost.ts, offline.ts, index.ts
│   ├── banks/                         # plaid, encryption, sync, items, csv, categories
│   ├── personas/                      # types, home, finance, index
│   ├── tools/                         # transactions, portfolio, market, drafts, runner (registry)
│   ├── market/                        # provider, yahoo, polygon, index
│   ├── data.ts, data-v2.ts            # V1 + V2 data-access (Supabase or mock)
│   ├── mock.ts, mock-v2.ts            # In-memory mock stores
│   ├── analytics.ts, categories.ts    # V1 primitives reused by Home tools
│   └── types.ts, types-v2.ts          # Domain types
└── supabase/
    ├── schema.sql + fix-rls-and-seed.sql   # V1
    ├── schema_v2.sql                        # V2 (holdings, watchlist, drafts, chat_*, persona_configs, usage_log)
    └── schema_v3.sql + fix-v3-rls.sql       # V3 (linked_items + external_id / provider_account_id columns)
```

The V3 bank-sync layer lives in `lib/banks/` (encryption, plaid client, items
CRUD, sync engine, csv parser, category mapping) with API surface at
`app/api/banks/*`, UI in `components/banks/`, and shared browser helpers in
`components/banks/plaidExchangeFlow.ts` (used by the Money dashboard button and
`/banks/return`).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in any vars you have — every section is optional
npm run dev
```

Open <http://localhost:3000>. Use `⌘K` anywhere to open the chat drawer.

## Environment variables

All optional — missing ones degrade gracefully.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Live Supabase (else mock data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Reserved for privileged server-side writes |
| `OPENAI_API_KEY` | Enables OpenAI-backed personas |
| `ANTHROPIC_API_KEY` | Enables Anthropic-backed personas |
| `JARVIS_AI_PROVIDER` | Optional global override (`openai` \| `anthropic`) — useful when you only have one key |
| `JARVIS_MARKET_PROVIDER` | `yahoo` (default, no key) or `polygon` |
| `POLYGON_API_KEY` | Used by the Polygon market provider once implemented |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid API credentials; create at <https://dashboard.plaid.com/team/keys> |
| `PLAID_ENV` | `sandbox` (default, free, fake data) or `production` |
| `PLAID_REDIRECT_URI` | Must match **`/banks/return`** on an **HTTPS** origin in Production (Plaid rejects `http://localhost` in Production). Use your deployed URL or **ngrok** locally. Register the same URL in Plaid Dashboard → Allowed redirect URIs. Sandbox can use `http://localhost:3000/banks/return`. |
| `PLAID_WEBHOOK_URL` | URL Plaid pings on updates; in dev pair this with `ngrok http 3000` |
| `JARVIS_ENCRYPTION_KEY` | 32-byte hex key (64 chars) used to AES-GCM-encrypt Plaid access tokens at rest |

## Applying the database

V1 first (one-time):

```bash
npm run setup:live   # interactive: applies schema + fix-up, runs smoke test
```

V2 (after V1):

1. Supabase Dashboard → SQL Editor → New query.
2. Paste [`supabase/schema_v2.sql`](./supabase/schema_v2.sql) → Run.
3. Paste [`supabase/fix-v2-rls-and-seed.sql`](./supabase/fix-v2-rls-and-seed.sql) → Run.
   (Supabase auto-enables RLS on newly-created tables — same gotcha as V1. This script
   disables it and idempotently seeds `holdings` / `watchlist` / one starter `draft` so
   the anon key can read them.)
4. `npm run check:v2` — verifies the schema, seeds, chat persistence and OpenAI/Anthropic keys.

Both schemas are idempotent. RLS stays off in V2 (still single-user); the migration path is documented inside `schema_v2.sql` for when auth lands.

V3 (Plaid + CSV bank sync, after V2):

1. Supabase Dashboard → SQL Editor → New query.
2. Paste [`supabase/schema_v3.sql`](./supabase/schema_v3.sql) → Run. This adds `linked_items` plus the `external_id` / `provider_account_id` columns to existing tables.
3. Paste [`supabase/fix-v3-rls.sql`](./supabase/fix-v3-rls.sql) → Run (disables RLS on `linked_items` and adds any missing columns such as `last_error` if you created the table from an older `schema_v3`).
4. `npm run check:banks` — verifies env vars, schema, encryption key, and Plaid connectivity.

## Plaid read-only posture

Jarvis does **not** move money, initiate payments, or modify your bank accounts. Plaid is used as a **read** path into balances/transactions/holdings metadata, and the app only **copies** that data into **your** Supabase project.

**Link token products** (narrow consent): `transactions`, `investments` only — configured in [`lib/banks/plaid.ts`](./lib/banks/plaid.ts). We do **not** request Plaid Auth (ACH account/routing numbers), Payment Initiation, Transfer, Signal, or similar write-capable products.

**Server-side Plaid calls in this repo** (via [`lib/banks/sync.ts`](./lib/banks/sync.ts), [`app/api/banks/exchange/route.ts`](./app/api/banks/exchange/route.ts), [`app/api/banks/items/[id]/route.ts`](./app/api/banks/items/[id]/route.ts), [`app/api/banks/webhook/route.ts`](./app/api/banks/webhook/route.ts)):

| Plaid API | Purpose |
| --- | --- |
| `/link/token/create` | Start Link |
| `/item/public_token/exchange` | Exchange one-time `public_token` for `access_token` |
| `/accounts/get` | Account names, types, masks |
| `/transactions/sync` | Incremental transaction history |
| `/investments/holdings/get` | Brokerage positions |
| `/institutions/get_by_id` | Institution display name |
| `/item/remove` | Revoke this app’s Item at Plaid when you disconnect (does not close bank accounts) |
| `/webhook_verification_key/get` | Verify webhook JWT signatures |

**Writes:** only to your database (`transactions`, `holdings`, `accounts`, `linked_items`, encrypted token storage). Disconnect deletes the Plaid Item at Plaid and your `linked_items` row; it does not withdraw or transfer funds.

## Bank sync runbook (Plaid)

1. **Sign up at Plaid.** <https://dashboard.plaid.com/signup>. The free **Trial** tier covers 10 production Items with no expiry.
2. **Grab keys.** Dashboard → Team Settings → Keys. Copy `client_id` plus the `Sandbox` (and later `Production`) secret.
3. **Generate an encryption key once** and paste it into `.env.local`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Apply the v3 schema** (see above) and run `npm run check:banks` until everything is green.
5. **Sandbox flow.** With `PLAID_ENV=sandbox`, `npm run dev`, open the Money dashboard → "Connect bank" → pick "Bank of America (Plaid Test)" → login `user_good` / `pass_good`. You should see transactions land within a few seconds and the Connections card status flip to `active`.
6. **Production switch.**
   - **Plaid Dashboard:** Team → Keys → copy the **Production** secret (same `client_id` as Sandbox). Complete any company verification Plaid requires for Production access.
   - **Allowed redirect URIs:** add `https://<your-domain>/banks/return` for a deployed app. For **local laptop + Production Plaid**, Plaid requires **HTTPS** — use **ngrok** (e.g. `https://abc123.ngrok-free.app/banks/return`) and register that exact URL; `http://localhost:...` is rejected (`INVALID_FIELD`). Must match `PLAID_REDIRECT_URI` exactly.
   - **Webhooks:** set the webhook URL to `https://<your-domain>/api/banks/webhook` (or ngrok in dev).
   - **`.env.local`:** `PLAID_ENV=production`, `PLAID_SECRET=<production secret>`, `PLAID_REDIRECT_URI`, `PLAID_WEBHOOK_URL` as above. Restart the dev server or redeploy.
   - **Re-link:** Sandbox Items do not carry over. On the Money dashboard, use **Connect bank** again after switching env.
7. **CSV fallback.** Any time Plaid isn't an option, the "CSV import" card on the Money dashboard accepts a Bank-of-America CSV (or any Date/Description/Amount export) and dedupes via the same `external_id` index.

## Scripts

```bash
npm run dev         # Next.js dev server
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run check:db    # verify V1 schema + RLS + read/write against live Supabase
npm run check:v2    # verify V2 schema + seeds + chat persistence + AI provider probe
npm run check:banks # verify V3 (Plaid) env, schema, encryption key, /institutions/get ping
npm run setup:live  # interactive V1 schema apply + smoke test
```

## Deploying to Vercel

```bash
git push -u origin main
# In Vercel project settings, add the env vars above.
# yahoo-finance2 is declared in serverComponentsExternalPackages — no extra config needed.
```

## What's next (Phase 4 — deferred)

1. **Auth + RLS** — magic-link, add `user_id` to every table (including `linked_items`), lock down policies. Move encrypted access tokens to Supabase Vault once it's GA.
2. **Publishing surface** — promote drafts to a public `posts` table; `/jarvis/[author]/[slug]` reader.
3. **Comments / reactions / subscriptions** — social layer atop the storyteller.
4. **Background sync scheduler** — nightly cron / Supabase Edge Function to top up Plaid items, on top of the existing webhook + manual button.
5. **Liabilities product** — credit-card APR, mortgage balance via Plaid Liabilities.
6. **Real holdings history** — daily price snapshots for true point-in-time net worth.
7. **Persona editor** — UI to override `persona_configs` (already in `schema_v2.sql`).

---

Built to feel like a wealth + research command center, not a budgeting app. Keep shipping.
