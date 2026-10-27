# Handoff — last updated 2026-10-27 (session 5)

## Where things are
- Code: `C:\Users\Kingsaab\Documents\Raasta`; private repo https://github.com/thekingsaabje/raasta (work on `dev`; `main` = last live-tested release).
- Live: **https://raasta.raasta.workers.dev** (Cloudflare account thekingsaabje@gmail.com, Worker `raasta`).
- D1 `raasta-db` (region WNAM/US West — created there because of the local proxy; deleting/recreating in APAC was blocked by the permission classifier).
  Migrations 0001–0004 applied. Seeded once; **never re-run seed.sql remotely.**
- Admin on live: thekingsaabje@gmail.com (only user; promoted via D1, audit row present).
- Backups: `backups/` (git-ignored). Latest: `raasta-db-pre-deploy-2026-10-27.sql` (before migration 0004 + status sync). Restore rehearsed into a separate local D1.

## Scholarship data (live, 2026-10-27)
32 real records + 2 `[TEST]` records. **All 32 real records are NEEDS_REVIEW** (founder rule: AI evidence never verifies).
Research evidence: cycle_state open 5 / upcoming 1 / closed 12 / unknown 14, plus proposed_deadline and a plain-English status_reason.
0 verified rules on real records. 32 open `verify_record` tasks. Only an admin confirming in Admin → Scholarships makes a record VERIFIED_* (method `human`).
Status sync: `node scripts/build-status-sync.mjs` → `seed/status-sync.sql` (idempotent, skips human-confirmed records).
37 sources (incl. deadline pages registered for monitoring). 18 open review tasks (mostly `verify_record`).
Key findings: Pakistan NOT eligible for Invest Your Talent in Italy, MAECI 2026-27, DAAD STEM and DAAD Master All Disciplines.
Italian DSU (ER.GO, DiSCo, DSU Toscana): Pakistan not on the "particularly poor countries" list → full family income/asset documents needed.
Pipeline: `research/verification.json` → `npm.cmd run verify:build` → `seed/verification-update.sql` (idempotent, history-preserving).

## Scheduled job
`17 */4 * * *` UTC (08:17, 12:17, 16:17 … PKT), 6 sources/run. Verified live on 2026-10-25 with a temporary 2-minute schedule:
two runs `outcome: ok`, 6 checked each (5 and 4 ok), CPU 10 ms / 38 ms, wall 8 s / 25 s, no false "changed".
Monitor never changes a scholarship status; change → one `source_changed` task; 3 failures → `source_failing`; past deadlines → `deadline_passed`.

## Study route (session 5)
- `/route` = main entry (homepage CTA, nav). UI `src/pages/Route.tsx` + `src/pages/route/*`; logic `shared/route.ts`; API `worker/route.ts`
  (`POST /api/route/evaluate` public, 60/hr/IP; `POST /api/me/roadmap` idempotent). Draft in localStorage `raasta.route.draft.v1`.
- Sign-up without `next` lands on `/route`; `?next=/route` returns there and finishes a pending save.
- Session-5 tests: 97 Vitest, 26/26 Playwright live (desktop + mobile). See REPORT.md.

## Cost Planner (session 4)
- UI: `src/pages/Costs.tsx` + `src/pages/costs/*`; engine `shared/planner.ts`; API `worker/planner.ts`; migration 0003
  (`cost_references`, `fin_assessments` versioned per plan_id, `fx_rates`). References loaded live from `seed/cost-references.sql` (70 rows).
- Rates from open.er-api.com (free, attribution required, link shown in UI). If the call fails, cached rates or manual entry.
- Session-4 test status: 84 Vitest, 22/22 Playwright live (after main deploy) + 4/4 planner tests live after polish. See REPORT.md.

## Tests (2026-10-25)
- `npm.cmd test`: 63/63 (unit, API, monitor, reset links, seed + verification idempotency).
- `npm.cmd run test:e2e` locally: 18/18. Against live: 18/18 earlier this session on the redesign build; after the final deploy see REPORT.md.
- `node scripts/visual-check.mjs <url>`: 8 pages × desktop 1440×900 + mobile 390×844, no stuck animations / overflow (live).
- After every live e2e run: `DELETE FROM users WHERE email LIKE 'e2e-%@raasta.test'` and delete the "E2E test report" error report + its review task.
- Live sign-up limit is 20/IP/hour (`REGISTER_LIMIT_PER_HOUR`); two full e2e runs in one hour will hit it (by design).

## Deploy
`npm.cmd run deploy` (check the output shows a new "Current Version ID"; once a deploy silently didn't happen).
New migrations: back up → rehearse on a local copy (`--persist-to .wrangler/rehearsal`) → `npm.cmd run db:migrate:remote`.

## Costs
PKR 0. Workers Free + D1 free + GitHub free + firecrawl credits used by the research agent (existing account; no new spend approved or made).
