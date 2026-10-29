# Handoff — last updated 2026-10-27 (session 5)

## Where things are
- Code: `C:\Users\Kingsaab\Documents\Raasta`; private repo https://github.com/thekingsaabje/raasta (work on `dev`; `main` = last live-tested release).
- Live: **https://raasta.raasta.workers.dev** (Cloudflare account thekingsaabje@gmail.com, Worker `raasta`).
- D1 `raasta-db` (region WNAM/US West — created there because of the local proxy; deleting/recreating in APAC was blocked by the permission classifier).
  Live: migrations 0001–0007 (0006/0007 applied with `--file` on 2026-10-29 and recorded in `d1_migrations` by hand),
  plus `seed/rule-fixes-2026-10-29.sql` and `seed/korea-2026-10-29.sql`. Backup taken first:
  `backups/raasta-db-pre-session7-2026-10-29.sql`; rehearsal on a copy: every table identical, FK check 0.
  Worker version fa7f251a (asset index-BqYnI6qT.js). Live e2e 38/38; test users/report cleaned (1 user left).
  Never rebuild a parent table with RENAME (rewires child FKs) and remember DROP TABLE cascades: see 0007's header. Seeded once; **never re-run seed.sql remotely.**
- Admin on live: thekingsaabje@gmail.com (only user; promoted via D1, audit row present).
- Backups: `backups/` (git-ignored). Latest: `raasta-db-pre-deploy-2026-10-27.sql` (before migration 0004 + status sync). Restore rehearsed into a separate local D1.

## Scholarship data (live, 2026-10-27)
32 real records + 2 `[TEST]` records. **All 32 real records are NEEDS_REVIEW** (founder rule: AI evidence never verifies).
Research evidence: cycle_state open 5 / upcoming 1 / closed 12 / unknown 14, plus proposed_deadline and a plain-English status_reason.
0 verified rules on real records. 32 open `verify_record` tasks. Only an admin confirming in Admin → Scholarships makes a record VERIFIED_* (method `human`).
Status sync: `node scripts/build-status-sync.mjs` → `seed/status-sync.sql` (idempotent, skips human-confirmed records).
37 sources (incl. deadline pages registered for monitoring).
Key findings: Pakistan NOT eligible for Invest Your Talent in Italy, MAECI 2026-27, DAAD STEM and DAAD Master All Disciplines.
Italian DSU (ER.GO, DiSCo, DSU Toscana): Pakistan not on the "particularly poor countries" list → full family income/asset documents needed.
Pipeline: `research/verification.json` → `npm.cmd run verify:build` → `seed/verification-update.sql` (idempotent, history-preserving).

## Scheduled job
`17 */4 * * *` UTC (08:17, 12:17, 16:17 … PKT), 6 sources/run. Verified live on 2026-10-25 with a temporary 2-minute schedule:
two runs `outcome: ok`, 6 checked each (5 and 4 ok), CPU 10 ms / 38 ms, wall 8 s / 25 s, no false "changed".
Monitor never changes a scholarship status; change → one `source_changed` task; 3 failures → `source_failing`; past deadlines → `deadline_passed`.

## Session 7 (2026-10-29): student audit, checker, Korea
- AUDIT-STUDENTS.md: five-student walk-through and what changed.
- Free official-page checker: `worker/quotecheck.ts`, runs in the 4-hourly cron (QUOTE_CHECK_BATCH, default 5), admin
  "check now" at `POST /api/admin/scholarships/:id/check-source`. Records date + result; never changes status; missing quotes
  open a `source_changed` task. Badge "Open · checked 29 Oct" when quotes matched within 14 days.
- New rule kinds `nationality_excluded`, `residence_excluded` (DAAD/MAECI Pakistan exclusions → likely not eligible).
- Korea (KR): code everywhere; GKS undergraduate + graduate records (NEEDS_REVIEW). Pakistan eligibility/deadlines are in
  the 2027 GKS-U guidelines PDF (not downloaded: needs founder approval). No KR cost references yet (estimate says so).
- Libraries added (all free): @fontsource-variable/bricolage-grotesque + figtree (OFL), minisearch (MIT, catalogue
  search), @axe-core/playwright (MPL-2.0, tests/e2e/a11y.spec.ts).

## Study route (session 5)
- `/route` = main entry (homepage CTA, nav). UI `src/pages/Route.tsx` + `src/pages/route/*`; logic `shared/route.ts`; API `worker/route.ts`
  (`POST /api/route/evaluate` public, 60/hr/IP; `POST /api/me/roadmap` idempotent). Draft in localStorage `raasta.route.draft.v1`.
- Sign-up without `next` lands on `/route`; `?next=/route` returns there and finishes a pending save.
- Session-5 tests: 97 Vitest, 26/26 Playwright live (desktop + mobile). See REPORT.md.

## Homepage redesign (LIVE 2026-10-28, version 90302306)
- Fonts (since 2026-10-29): Bricolage Grotesque (display, weights 680–800, `var(--display)`; `--serif` is an alias) + Figtree (UI),
  self-hosted via @fontsource-variable (OFL). Emphasis = colour + highlighter, not italics. Pill nav, dark footer.
- `src/pages/Home.tsx`: hero, featured "looks open" cards, catalogue table with an **evidence meter** (lead/quoted/verified, never a chance of success),
  how it works, source-name marquee (text only, "not partnered"), bento, FAQ, mint band (no fake social proof), live numbers from `GET /api/stats`.
- Visibility checks use bottom-only margins (a negative margin on all sides broke the count-up on phones).

## Live discovery (session 6, LIVE since 2026-10-27)
- `/app/discover`. Logic: `shared/discovery.ts` (deterministic, no LLM). API: `worker/discovery.ts`. Migration `0005_discovery.sql` applied live (backup: `backups/raasta-db-pre-discovery-2026-10-27.sql`).
- `TAVILY_API_KEY` is set as a Worker secret (the founder's free account; the key is also in the git-ignored `.dev.vars`). CPU per search on the live site is 52–64 ms (above the 10 ms free guideline, but it completes).
- Providers: the official-source crawl (always) + Tavily (only if the `TAVILY_API_KEY` secret is set; cap `SEARCH_MONTHLY_CAP`, default 900).
- PDFs read via the Workers AI binding `AI` (Markdown Conversion; doesn't work in local `wrangler dev` on this PC because of the proxy, so test it live).
  Admin can paste evidence for bot-blocking official pages (Admin → Discoveries). 39 sources live (BUAA + PKU added 2026-10-27).
- Discoveries are evidence only: NEEDS_REVIEW → Admin → Discoveries. Changed pages return to review. Details in REPORT.md and DISCOVERY_PLAN.md.

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
