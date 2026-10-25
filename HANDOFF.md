# Handoff — last updated 2026-10-25

## Where things are
- Code: `C:\Users\Kingsaab\Documents\Raasta`; private repo https://github.com/thekingsaabje/raasta (branches `main`, `dev`; work on `dev`).
- Live: **https://raasta.raasta.workers.dev** (Cloudflare account thekingsaabje@gmail.com, Worker `raasta`).
- D1 `raasta-db` (id a10825fc-…, region WNAM — US West; created there because of the local proxy. Recreating in APAC was blocked; consider read replication later).
  Migrated and seeded once on 2026-10-25 (24 sources, 30 scholarships incl. 2 [TEST], 83 rules, 5 packages). **Do not re-run the seed.**
- No admin account on live yet: founder registers, then run the promote command below.
- Local run: `npm.cmd run dev` → http://localhost:5173. Local admin test account email is in `.dev.vars` (ADMIN_EMAILS).
- Live checks done 2026-10-25: Playwright 10/10 against the live URL (sign-up/login fine → PBKDF2 100k fits the CPU limit so far);
  signed-out /api/me and /api/admin → 401; cross-origin POST → 403; manual source-check run on live: 4/5 OK, campuschina.org returns 412 (blocks bots — needs manual checks).
  Cron trigger first fires 03:17 UTC 2026-10-26 — **not yet observed**; verify with the `source_checks` count query below.
  Throwaway e2e accounts were deleted from live afterwards (`DELETE FROM users WHERE email LIKE 'e2e-%@raasta.test'`) — do this after every live e2e run.

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
- `npm.cmd test`: 55/55 passed (eligibility, finance, progress, writing, checklist, API auth/isolation/admin/dashboard/writing/privacy/monitor, seed integrity).
- `npm.cmd run test:e2e` (local, desktop + mobile Chrome): 10/10 passed.

## Deploy steps (steps 1–2 already done; for future deploys run only migrations for new files + step 4)
1. `npx.cmd wrangler d1 create raasta-db` → put the id in `wrangler.jsonc`.
2. `npm.cmd run db:migrate:remote`, then **first deploy only** `npm.cmd run db:seed:remote`
   (the seed deletes all requirements and replaces scholarships — never re-run it on a live database with real reviews or students).
3. Do **not** set `ADMIN_EMAILS` in production (no email verification yet, so anyone could register that address first).
   After the founder registers on the live site, promote once:
   `npx.cmd wrangler d1 execute raasta-db --remote --command "UPDATE users SET role='admin' WHERE email='<founder email>'"`
4. `npm.cmd run deploy` (first time may ask to register a free workers.dev subdomain — run it in a terminal tab),
   then `$env:BASE_URL="https://raasta.<subdomain>.workers.dev"; npm.cmd run test:e2e`.
5. CPU check: password hashing took ~13 ms locally; Workers Free allows ~10 ms CPU per request. If live sign-up/login
   fails (error 1102), set var `PBKDF2_ITERATIONS` (e.g. 50000) — hashes store their own count, so old accounts keep working —
   or ask the founder about Workers Paid ($5/month).
6. Cron: configured (`17 3 * * *`, 20 pages/run) but **not yet verified live**. After the first run check
   `npx.cmd wrangler d1 execute raasta-db --remote --command "SELECT COUNT(*) FROM source_checks"`; if runs are cut short, lower the per-run limit.

## Costs
Everything runs on free tiers (Workers Free: 100k requests/day; D1 free limits; GitHub private repo free). No paid services used.

## Next actions
See TODO.md "Needs the founder" and "Data".
