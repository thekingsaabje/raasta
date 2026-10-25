# Handoff — last updated 2026-10-25

## Where things are
- Code: `C:\Users\Kingsaab\Documents\Raasta`, git branch `dev` (no remote yet — GitHub CLI not logged in).
- Deployment: **not deployed yet** — Cloudflare CLI not logged in. `wrangler.jsonc` has a placeholder `database_id`.
- Local run: `npm.cmd run dev` → http://localhost:5173. Local admin test account email is in `.dev.vars` (ADMIN_EMAILS).

## Works today (tested)
- Public site: home, catalogue (search, filters, compare up to 3), scholarship detail with per-rule evidence, error reports, pricing (payments off), cost planner, verification and privacy pages.
- Accounts: sign up (consent), log in/out, rate limits, admin role via secret.
- Student app: adaptive profile, Matches (deterministic eligibility per rule), applications with generated checklists,
  dependencies/blocking, student vs institution status, stage changes needing evidence, own tasks, dashboard
  (progress ring, next 3 actions, dates, attention, notifications), Writing Studio (policy modes, fact bank, checks,
  versions, fact confirmation), settings (notification prefs, JSON export, account deletion).
- Admin: coverage dashboard, source registry + manual check run, scholarship review (status/deadline/policy with
  reason → version history → linked tasks updated → affected students notified), rule verify/conflict, correction queue, audit log.
- Cron (`17 3 * * *`): checks ≤20 sources per run, flags changed pages for review, marks repeat failures inaccessible.

## Tests (last run 2026-10-25)
- `npm.cmd test`: 54/54 passed (eligibility, finance, progress, writing, checklist, API auth/isolation/admin/dashboard/writing/privacy/monitor, seed integrity).
- `npm.cmd run test:e2e` (local, desktop + mobile Chrome): 10/10 passed.

## Deploy steps (once logged in)
1. `npx.cmd wrangler d1 create raasta-db` → put the id in `wrangler.jsonc`.
2. `npm.cmd run db:migrate:remote` and `npm.cmd run db:seed:remote`.
3. `npx.cmd wrangler secret put ADMIN_EMAILS`.
4. `npm.cmd run deploy`, then `$env:BASE_URL="https://raasta.<subdomain>.workers.dev"; npm.cmd run test:e2e`.

## Costs
Everything runs on free tiers (Workers Free: 100k requests/day; D1 free limits; GitHub private repo free). No paid services used.

## Next actions
See TODO.md "Needs the founder" and "Data".
