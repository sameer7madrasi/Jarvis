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

## Folder structure

```
.
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # Streaming chat (tool loop)
│   │   ├── conversations/route.ts     # List threads / messages
│   │   ├── drafts/[slug]/route.ts     # GET / PATCH a draft
│   │   └── market/route.ts            # Server-side market proxy
│   ├── finance/
│   │   ├── drafts/[slug]/page.tsx     # Drafts editor
│   │   ├── drafts/page.tsx            # Drafts index
│   │   └── page.tsx                   # JarvisFinance shell
│   ├── home/page.tsx                  # JarvisHome shell
│   ├── settings/personas/page.tsx     # Persona settings
│   ├── layout.tsx                     # Root + AppShell
│   └── page.tsx                       # Money dashboard (V1)
├── components/
│   ├── AppShell.tsx, Sidebar.tsx, Dashboard.tsx, MetricCard.tsx, …  # V1 + nav
│   ├── chat/                          # ChatPanel/Message/Input/Drawer/Page/Avatar/CostChip/ToolCallChip
│   └── finance/                       # PortfolioTable, WatchlistCard, DraftList, DraftEditor
├── lib/
│   ├── ai/                            # provider.ts, cost.ts, offline.ts, index.ts
│   ├── personas/                      # types, home, finance, index
│   ├── tools/                         # transactions, portfolio, market, drafts, runner (registry)
│   ├── market/                        # provider, yahoo, polygon, index
│   ├── data.ts, data-v2.ts            # V1 + V2 data-access (Supabase or mock)
│   ├── mock.ts, mock-v2.ts            # In-memory mock stores
│   ├── analytics.ts, categories.ts    # V1 primitives reused by Home tools
│   └── types.ts, types-v2.ts          # Domain types
└── supabase/
    ├── schema.sql + fix-rls-and-seed.sql   # V1
    └── schema_v2.sql                        # V2 (holdings, watchlist, drafts, chat_*, persona_configs, usage_log)
```

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

## Applying the database

V1 first (one-time):

```bash
npm run setup:live   # interactive: applies schema + fix-up, runs smoke test
```

V2 (after V1):

1. Supabase Dashboard → SQL Editor → New query.
2. Paste [`supabase/schema_v2.sql`](./supabase/schema_v2.sql) → Run.
3. Refresh `/finance` — Portfolio/Watchlist/Drafts now read live tables.

Both schemas are idempotent. RLS stays off in V2 (still single-user); the migration path is documented inside `schema_v2.sql` for when auth lands.

## Scripts

```bash
npm run dev         # Next.js dev server
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run check:db    # verify V1 schema + RLS + read/write against live Supabase
npm run setup:live  # interactive V1 schema apply + smoke test
```

## Deploying to Vercel

```bash
git push -u origin main
# In Vercel project settings, add the env vars above.
# yahoo-finance2 is declared in serverComponentsExternalPackages — no extra config needed.
```

## What's next (Phase 3 — deferred)

Logged in [`jarvis_financial_storyteller_plan`](./.cursor/plans/jarvis_financial_storyteller_plan_1f3ea263.plan.md):

1. **Auth + RLS** — magic-link, add `user_id` to every table, lock down policies.
2. **Publishing surface** — promote drafts to a public `posts` table; `/jarvis/[author]/[slug]` reader.
3. **Comments / reactions / subscriptions** — social layer atop the storyteller.
4. **Plaid integration** — replace manual transaction entry for the Money dashboard.
5. **Real holdings history** — daily price snapshots for true point-in-time net worth.
6. **Persona editor** — UI to override `persona_configs` (already in `schema_v2.sql`).

---

Built to feel like a wealth + research command center, not a budgeting app. Keep shipping.
