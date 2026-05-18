# Deploy Jarvis to Vercel (solo production)

This repo is a standard **Next.js 14** app. Vercel auto-detects the framework; no `vercel.json` is required. Follow the steps below on **your machine** and in the **Vercel / Plaid** dashboards (the agent cannot log into your accounts).

**Source repo:** `https://github.com/sameer7madrasi/Jarvis` (confirm this matches what you import in Vercel).

---

## 1. GitHub (code on `main`)

- Working tree should be clean and **`main`** pushed to `origin`.
- Vercel will build whatever commit is at the branch you select (usually `main`).

```bash
git status
git push origin main
```

---

## 2. Vercel — create the project

1. Sign in at [vercel.com](https://vercel.com).
2. **Add New… → Project** → **Import** the GitHub repo `Jarvis`.
3. **Root Directory:** leave default (repository root, where `package.json` lives).
4. **Framework Preset:** Next.js (auto).
5. **Build Command:** `npm run build` (default).
6. **Install Command:** `npm install` (default).
7. Click **Deploy** for a first build (it may fail until env vars exist—that is OK).

**CLI alternative (optional):** install [Vercel CLI](https://vercel.com/docs/cli), run `vercel login`, then from the repo root:

```bash
vercel link
vercel --prod
```

---

## 3. Vercel — Production environment variables

After the first deploy, open **Project → Settings → Environment Variables**. Add each variable for **Production** (use **Sensitive** / **Encrypted** for secrets).

| Name | Value / notes |
|------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `.env.local` |
| `JARVIS_ENCRYPTION_KEY` | Same 64-char hex as local if you already linked banks and want tokens to keep working; if you change it, **re-link** every institution |
| `PLAID_CLIENT_ID` | From Plaid Dashboard → Keys |
| `PLAID_SECRET` | **Production** secret (not Sandbox) |
| `PLAID_ENV` | `production` |
| `PLAID_REDIRECT_URI` | `https://<YOUR-VERCEL-HOST>/banks/return` — replace with your real deployment hostname (see below) |
| `PLAID_WEBHOOK_URL` | `https://<YOUR-VERCEL-HOST>/api/banks/webhook` |
| `OPENAI_API_KEY` | If you use JarvisHome / JarvisFinance with OpenAI |
| `ANTHROPIC_API_KEY` | If you use Anthropic |
| `JARVIS_AI_PROVIDER` | Optional override |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional; only if you add privileged server routes |

**Hostname:** use the URL Vercel shows after deploy, e.g. `https://jarvis-xxx.vercel.app` or your custom domain. **No trailing slash** on `PLAID_REDIRECT_URI` unless you registered one in Plaid.

After saving variables: **Deployments → … → Redeploy** (or push an empty commit) so serverless routes read the new env.

---

## 4. Plaid Dashboard (Production)

1. **Allowed redirect URIs:** add exactly  
   `https://<YOUR-VERCEL-HOST>/banks/return`
2. **Webhook URL:**  
   `https://<YOUR-VERCEL-HOST>/api/banks/webhook`

Strings must match Vercel env vars **character-for-character** (https, host, path).

3. If you previously linked with **ngrok** or localhost, **Connect bank** again on the **Vercel URL** so the Item is created against the production hostname.

---

## 5. Smoke test (live)

1. Open **`https://<YOUR-VERCEL-HOST>/`** in the browser (not localhost).
2. **Money** → **Connections** → **Connect bank** → complete institution OAuth (you should pass through `/banks/return`).
3. **Sync now** and confirm transactions / holdings appear.
4. Optional: Plaid Dashboard → **Webhooks** → delivery logs for `POST /api/banks/webhook`.

---

## 6. Operational notes

- **Function duration on Hobby vs Pro:** `app/api/banks/sync/route.ts` and `app/api/banks/csv/route.ts` declare `maxDuration = 60`, but **Vercel Hobby caps every serverless function at ~10s** and ignores the hint. The initial Plaid backfill (90 days of transactions + investment holdings) routinely exceeds that, so on Hobby the sync request that runs immediately after linking a bank will return **504**. This is expected and handled:
  - The OAuth completion flow in `components/banks/plaidExchangeFlow.ts` calls `/api/banks/sync` as fire-and-forget (`keepalive: true`) and returns as soon as `/api/banks/exchange` succeeds, so the user is redirected to `/?bankLinked=1` within a couple of seconds even if sync times out.
  - Plaid then pushes `TRANSACTIONS:INITIAL_UPDATE` / `HISTORICAL_UPDATE` to `/api/banks/webhook` over the next 1–2 minutes; each webhook delivery triggers `syncItem` inside its own 10s budget, which is enough for incremental cursor pages.
  - **Manual "Sync now"** on the Connections card still hits the 10s cap on Hobby; for a fully synchronous large sync, upgrade to **Pro** where `maxDuration = 60` is honored.
- **If Connections still shows "No banks linked yet" right after OAuth:** check the Vercel function logs for `[banks/exchange]`. The route emits `linked_items row created` on first link and `already_linked short-circuit` when Plaid returns an existing `item_id` — the latter means a stale row (often from a local dev run) is hiding the fresh link. Resolve by `delete from linked_items where provider = 'plaid';` in Supabase and re-linking.
- **Preview deployments:** usually omit Production Plaid secrets from Preview envs, or use Plaid Sandbox for Preview only.
- **Never commit** `.env.local`; keep secrets only in Vercel and local files.

---

## Checklist (copy for yourself)

- [ ] `main` pushed to GitHub  
- [ ] Vercel project imported and Production deploy green  
- [ ] All env vars set for **Production** and redeployed  
- [ ] Plaid redirect + webhook URLs updated for Vercel hostname  
- [ ] Opened deployed site, **Connect bank**, **Sync now**, data visible  

When all boxes are checked, you are live for solo production with up-to-date data (webhooks + manual sync).
