# Raasta — session 3 report (2026-10-25)

## Links
- Repo (private): https://github.com/thekingsaabje/raasta — branch `dev`; `main` updated after the final live test (commit in chat).
- Live: https://raasta.raasta.workers.dev (Worker version 0388afb5).

## Audit of earlier claims (checked, not assumed)
- 55 code tests and 10 browser tests (5 tests × 2 screen sizes): confirmed before changes. 24 sources / 28 researched scholarships: confirmed.
- GitHub CLI and Cloudflare CLI: both logged in (verified with `gh auth status`, `wrangler whoami`).
- Scheduled job: had **never run** before this session (5 source checks, all from a manual run). Now verified — see below.

## Admin account
- Only one user on live: thekingsaabje@gmail.com, role admin, audit row present. Promotion was a one-off database update; there is no self-promotion endpoint.
- Live tests (throwaway accounts, deleted afterwards): a student gets 403 on admin APIs and "Admins only" on /admin; cannot read or change another student's applications or tasks.
- I could not log in as you (I don't have your password). Admin access for your account is verified at the database level only.
- Password recovery: admin-issued single-use 24h link (no email provider yet). Account deletion and data export: covered by API tests.

## Scholarship records (live, real data)
| Status | Count | How checked |
|---|---|---|
| VERIFIED_OPEN | 5 | Auto-checked: verbatim quote from the official page's raw text |
| VERIFIED_UPCOMING | 1 | Auto-checked |
| VERIFIED_CLOSED | 12 | Auto-checked |
| NEEDS_REVIEW | 14 | Evidence missing, outdated or ambiguous → review task opened |
| Test records | 2 | Labelled `[TEST]`, hidden by default |
- None is "human-verified" yet. The site labels the 18 auto-checked ones "auto-checked" and explains the difference.
- I independently re-fetched two claims: the Heinrich Böll and Tsinghua dates matched the official pages word for word.
- Settled with official evidence: Pakistan is **not eligible** for Invest Your Talent in Italy, MAECI 2026-27, DAAD STEM, or DAAD Master All Disciplines. Italian regional DSU grants need full translated, legalised family income documents for Pakistani applicants.
- 4 new records added: DSU Toscana PhD, DAAD Doctoral Programmes, DAAD Fine Art/Design/Film, Konrad-Adenauer-Stiftung.
- Coverage: this is a starting inventory, not complete. Unreadable: EDISU Piemonte, Jiangsu Jasmine, ANSO and Shanghai funding tables (images), campuschina.org (blocks bots).
- No renewal or annual-review records are catalogued yet, so continuing students rely on their own tasks.

## Scheduled research job
- Schedule: every 4 hours at :17 UTC (08:17, 12:17, … Pakistan time), 6 sources per run.
- Verified on Cloudflare with a temporary 2-minute schedule: two runs, both `outcome: ok`, 6 pages checked each (5 and 4 fetched), CPU 10 ms and 38 ms, no false "changed".
- Hardened: hashes only main page content; one review task per issue (repeat runs don't duplicate); never changes scholarship statuses; flags passed deadlines on verified-open records. Covered by API tests.

## Redesign
- Diagnosed against the reference at 1440×900: product hidden below the fold, cluttered cards, heavy pill filters, borders and shadows everywhere, small grey text.
- New system: editorial type scale, panels instead of cards, a reference-style data table with search and dropdown filters, comparison that survives filter changes, and a cleaner nav.
- Rebuilt: home (live catalogue under the hero), catalogue, scholarship detail (rules grouped by what they decide, with quotes and next steps), dashboard (stat strip, next actions, monthly agenda, relevant opportunities, funding actions), matches, admin (review queue, reset links, job health). Other pages use the same tokens.
- Mobile 390×844: dedicated layouts for the table, filters and stat strip.
- `scripts/visual-check.mjs` checked 8 public pages × 2 sizes on live: no stuck animations, no horizontal overflow.
- Your Chrome window won't shrink below about 1290 px, so mobile checks used Playwright and the built-in browser's emulation.

## Tests actually run
- Code: 63/63 pass (eligibility incl. scopes and next actions, funding classes, finance, progress, writing, checklist, API auth/isolation/admin, monitor, reset links, seed and verification idempotency).
- Browser (local): 18/18 — the core journey on desktop and mobile, and 7 student journeys plus a security journey on desktop.
- Browser (live): 18/18 on the redesign build earlier. On the final build: 9/10 non-sign-up tests passed; the 10th hit the sign-up limit by design. The full re-run result is in the chat.
- Hand checks in the browser: home, catalogue, dashboard, application checklist, writing, costs, pricing and admin at desktop; home, catalogue, detail and dashboard at mobile.

## Defects found and fixed
1. A slow or repeated profile load wiped answers the student had started typing.
2. Comparing a German and an Italian award dropped the first after switching country.
3. Linked rows lost their layout (arrows wrapping).
4. Mobile catalogue rows squeezed names; filters wrapped badly; dashboard tiles stacked one per row.
5. The monitor would have flagged pages as "changed" on menu or script noise, and could pile up duplicate alerts.
6. Admin coverage showed no job health or verification method.
7. One deploy didn't go out silently; caught by checking the served asset hash, then redeployed.

## Not done / limitations
- No automated accessibility audit yet (manual review only).
- No email provider, so no self-service reset and no email reminders. The reminder job itself isn't built.
- Assisted and managed applications are not offered (the API refuses them).
- Payments stay off.
- The database is in US West.
- Two full live test runs in one hour hit the sign-up limit (by design).

## Tools used
Claude in Chrome (logins, reference screenshots), built-in browser (local QA), Playwright, Vitest, Firecrawl (raw-text research via the existing connector), a research subagent, Context7 docs. No new plugins installed; nothing paid was purchased.

## Costs
Actual: PKR 0 new spend. Firecrawl credits came from the already-connected account. Projected: free tiers are enough for a pilot (Workers 100k requests/day).

## Next steps
1. Review and confirm the 18 auto-checked records in Admin → Scholarships, starting with the open ones.
2. Clear Admin → Review tasks.
3. Decide on an email provider (approval needed).
4. Build the deadline-reminder job.
5. Expand coverage of Chinese provincial awards and renewal records.
