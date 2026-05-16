# Capital OS — Money Command Center

A clean, full‑stack personal finance dashboard built around the **"A Million by 30"** goal. Think of it less as a budgeting app and more as a **personal capital allocation cockpit**: it tracks how you earn, spend, save, and invest so you can see the surplus you're routing into wealth each month.

V1 is intentionally narrow: manual entry, a useful dashboard, and a clean foundation.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with a custom dark, premium palette
- **Supabase / Postgres** for persistence (with a local mock‑data fallback)
- **Recharts** for charts
- **lucide-react** for icons

## V1 features

- **Transaction entry** — date, merchant/source, amount, type (income / expense / investment), category, account, optional notes.
- **Transaction table** — recent transactions with type / category / month filters and a delete action. Expenses, income and investments are visually distinct.
- **Dashboard metrics** — monthly income, expenses, net cash flow, savings rate, total invested, and a rough net‑worth placeholder.
- **Charts** — spending by category (donut), income vs expenses (bar, 6 months), investment contributions (area + cumulative).
- **Mindset panel** — a subtle "A Million by 30" progress bar tied to the net‑worth estimate.
- **Mock‑data fallback** — if Supabase env vars aren't set, the UI still renders with realistic mock data so you can demo it locally instantly.

## Folder structure

```
.
├── app/
│   ├── globals.css            # Tailwind base + theme overrides
│   ├── layout.tsx             # Root layout (dark theme)
│   └── page.tsx               # Dashboard entry
├── components/
│   ├── Dashboard.tsx          # Orchestrator (state, layout)
│   ├── MetricCard.tsx
│   ├── MindsetPanel.tsx       # "A Million by 30" panel
│   ├── TransactionForm.tsx
│   ├── TransactionTable.tsx
│   ├── SpendingByCategoryChart.tsx
│   ├── IncomeExpenseChart.tsx
│   ├── InvestmentChart.tsx
│   ├── charts/ChartTooltip.tsx
│   └── ui/                    # Card, Button, Input/Select/Textarea, Label
├── lib/
│   ├── analytics.ts           # Pure functions: monthlyTotals, spendingByCategory, monthlySeries…
│   ├── categories.ts          # Default income / expense / investment categories
│   ├── data.ts                # Data-access layer: Supabase OR mock fallback
│   ├── mock.ts                # Realistic in-memory mock dataset
│   ├── supabase.ts            # Supabase client + env detection
│   ├── types.ts               # Account, Transaction, MonthlySnapshot, …
│   └── utils.ts               # cn(), currency / percent / date formatters
└── supabase/
    └── schema.sql             # Postgres schema + seed accounts
```

## 1. Files created

- Configuration: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.gitignore`, `.env.example`, `next-env.d.ts`
- App: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Components: `components/Dashboard.tsx`, `MetricCard.tsx`, `MindsetPanel.tsx`, `TransactionForm.tsx`, `TransactionTable.tsx`, `SpendingByCategoryChart.tsx`, `IncomeExpenseChart.tsx`, `InvestmentChart.tsx`, `charts/ChartTooltip.tsx`, `ui/Card.tsx`, `ui/Button.tsx`, `ui/Field.tsx`
- Lib: `lib/types.ts`, `lib/categories.ts`, `lib/utils.ts`, `lib/analytics.ts`, `lib/supabase.ts`, `lib/mock.ts`, `lib/data.ts`
- Database: `supabase/schema.sql`

## 2. Setup steps

```bash
# from the project root
npm install
cp .env.example .env.local   # optional — leave blank to use mock data
npm run dev
```

Open <http://localhost:3000>.

## 3. Required environment variables

All optional in V1 — if missing, the app falls back to in-memory mock data.

| Variable | Where to find it | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API | Persisting data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API | Persisting data |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API | Reserved for future server-only writes |

## 4. Running locally

```bash
npm run dev         # Next.js dev server (http://localhost:3000)
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run check:db    # verify schema + RLS + read/write against live Supabase
npm run setup:live  # interactive: prints fix-up SQL, polls until applied, runs smoke test
```

## 5. Applying the Supabase schema

Option A — interactive (recommended the first time):

```bash
npm run setup:live
```

This walks you through:

1. Probing your live project to see what's missing.
2. Printing the exact SQL to paste (and the direct SQL editor URL).
3. Polling every 3s until you've applied it.
4. Running an end-to-end smoke test (insert income / expense / investment, read, delete).

Option B — manual:

1. Open **SQL Editor → New query** in your Supabase project.
2. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) → Run.
3. Paste the contents of [`supabase/fix-rls-and-seed.sql`](./supabase/fix-rls-and-seed.sql) → Run.
   (Supabase auto-enables RLS on new tables — V1 has no auth, so we disable it. The same file idempotently re-seeds the default accounts.)
4. Run `npm run check:db` to verify.

> V1 has **no auth and no RLS policies**. Only run this against a personal/private project until auth is added in a later phase.

## 5a. Deploying to Vercel (optional)

```bash
# 1. Push to GitHub (create the repo first at https://github.com/new)
git remote add origin git@github.com:<you>/capital-os.git
git push -u origin main

# 2. Import at https://vercel.com/new
#    Add these env vars in the Vercel project settings:
#      - NEXT_PUBLIC_SUPABASE_URL
#      - NEXT_PUBLIC_SUPABASE_ANON_KEY
#      - SUPABASE_SERVICE_ROLE_KEY  (mark as Sensitive)
#    Click Deploy. Build runs `next build` (verified passing).
```

## 6. Next recommended phase

In rough priority order:

1. **Auth + RLS** — Supabase magic-link auth, add `user_id` to all tables, lock down with row-level security.
2. **Categories table** — promote categories from code to a `categories` table with colors and per-user customization.
3. **Plaid integration** — automatic bank/credit/brokerage sync (see `TODO`s sprinkled in `lib/supabase.ts` and the app footer).
4. **Real holdings & net worth** — `holdings` table (symbol, qty, cost basis) + daily price job to replace the V1 net-worth placeholder.
5. **AI insights** — monthly review, anomaly detection, savings/allocation suggestions written to an `ai_insights` table.
6. **Recurring transactions** — model rent, salary, subscriptions as recurring rules so the dashboard projects forward.
7. **Goals & scenarios** — multiple goals beyond Million by 30, with "what if I invest +$500/mo" scenario sliders.

---

Built to feel like a wealth command center, not a budgeting app. Keep shipping.
