# TODO (priority order)

## Needs the founder
- [ ] Approve the production deploy of session 7 (migrations 0006–0007, rule fixes, Korea data, new site). Steps in HANDOFF.md.
- [ ] Allow downloading the official 2027 GKS-U Application Guidelines PDF (Study in Korea, ~1.4 MB) to fill Korea deadlines and Pakistan eligibility.
- [ ] Confirm records in Admin → Scholarships (all 32 are unverified until you do; "Verified fits" stays empty). Start with the ones that look open: Tsinghua freshmen (20 Nov 2026), DSU Toscana PhD (16 Nov 2026), Politecnico di Milano (15 Dec 2026), Heinrich Böll (15 Jan–1 Mar 2027). Use "Confirm all quoted rules" only after reading each quote against the official page.
- [ ] Work through Admin → Review tasks (32 `verify_record` tasks).
- [ ] Decide on an email provider (e.g. Resend free tier) for self-service password reset and email reminders — needs an account (approval).
- [ ] Optional: move D1 closer to Pakistan (APAC) — requires approving a database delete/recreate or D1 read replication.
- [ ] Later: domain purchase; payment provider that supports a Pakistan business + PKR.

## Live discovery (session 6)
- [x] Deployed 2026-10-27 (backup, rehearsal, migration, live e2e 2/2, e2e users deleted).
- [x] Tavily key set as a Worker secret (2026-10-27).
- [ ] Founder: review results in Admin → Discoveries; review `LISTED_DOMAINS` in shared/discovery.ts.
- [x] PDF calls read via the Workers AI binding (2026-10-27). Check Workers AI usage on the dashboard after a week.
- [x] Admin paste-evidence for bot-blocking official pages (campuschina.org, csc.edu.cn).
- [ ] Founder: paste the current CSC / campuschina.org call text once the 2027-28 call is published.
- [ ] Widen English-requirement patterns (Polimi's wording was read as "not stated").
- [ ] CPU per search is 52–64 ms live (free guideline 10 ms). If searches start failing: lower MAX_PAGES/MAX_HTML, or approve Workers Paid ($5/month).
- [ ] Local only: reset `test-cn-master` to NEEDS_REVIEW in local D1 (4 local e2e tests expect it).

## Data
- [ ] Unreadable sources: EDISU Piemonte, Jiangsu Jasmine (jsnu.edu.cn), ANSO and Shanghai funding tables (images), campuschina.org (blocks bots, HTTP 412).
- [ ] Expand inventory: Chinese provincial/municipal and top-university awards incl. continuing-student renewals; German state schemes; all Italian DSU regions.
- [ ] Gold-standard test library: expected eligibility for sample profiles against real verified records.
- [ ] Renewal/annual-review records for China (none catalogued yet — Journey 7 currently relies on student-entered tasks).

## Product
- [ ] Self-service password reset + email verification (after email provider).
- [ ] Deadline reminders at 30/14/3 days (notifications table exists; job not built).
- [ ] Admin: create/edit scholarships and rules in the UI (today: research pipeline + review screens).
- [ ] Entitlements, orders and refund policy before any paid feature (payments stay off).
- [ ] Optional AI explanations behind `AI_ENABLED` with a spending cap (needs API key approval).

## Study route follow-ups
- [ ] Unique index on applications(user_id, scholarship_id) to make the roadmap race-proof (client already guards).
- [ ] Route results: compare two routes side by side; show proof-of-funds guidance per country.

## Quality
- [ ] Automated accessibility audit (axe/Lighthouse) — not run yet; manual keyboard/contrast review only.
- [ ] CSP header; admin 2FA; split motion library from the main bundle (index ~135 KB gzip).
- [ ] CI: run unit tests + Playwright on GitHub Actions (free tier).

## Done 2026-10-25 (session 4)
- [x] forLevels on rules, zod rule schema, safe assess, closed-call rules never reject, real-data regression test.
- [x] Conversational Cost Planner with 3 scenarios, official cost references, saved versions, dashboard card.

## Cost Planner follow-ups
- [x] Gap round 1 (free tools): DE insurance + TUM fee; IT visa fee PKR; CN CSC stipend, visa-centre fee, Tsinghua/Fudan/Wuhan fees, Wuhan bank minimum.
- [x] PDF round (approved): Padova + Polimi DSU amounts and residence costs, Fudan 2026 tuition + RMB 100,000 guarantor deposit, RWTH ticket part.
- [ ] RWTH full semester contribution (fee-rules PDF returned 403); UniMi 2026/27 DSU call not located.
- [ ] Remaining: BLS study-visa service fee (site blocks bots), Islamabad Oct–Dec fee (not yet posted), Tsinghua UG tuition, national China bank minimum.
- [ ] Admin screen to review/edit `cost_references` (today: research/finance-sources.json → npm run refs:build).
- [ ] Optional: match tuition references to the chosen university automatically.
- [ ] Firecrawl credits are low — founder decides whether to top up before the next research round.
