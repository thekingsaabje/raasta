# TODO (priority order)

## Needs the founder
- [ ] Review the 18 "auto-checked" records in Admin → Scholarships and confirm them (turns them into reviewer-verified). Start with the open ones: Politecnico di Milano (15 Dec 2026), Tsinghua freshmen (20 Nov 2026), DSU Toscana PhD (16 Nov 2026), Heinrich Böll (15 Jan–1 Mar 2027).
- [ ] Work through Admin → Review tasks (14 records need human verification).
- [ ] Decide on an email provider (e.g. Resend free tier) for self-service password reset and email reminders — needs an account (approval).
- [ ] Optional: move D1 closer to Pakistan (APAC) — requires approving a database delete/recreate or D1 read replication.
- [ ] Later: domain purchase; payment provider that supports a Pakistan business + PKR.

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

## Quality
- [ ] Automated accessibility audit (axe/Lighthouse) — not run yet; manual keyboard/contrast review only.
- [ ] CSP header; admin 2FA; split motion library from the main bundle (index ~135 KB gzip).
- [ ] CI: run unit tests + Playwright on GitHub Actions (free tier).

## Done 2026-10-25 (session 4)
- [x] forLevels on rules, zod rule schema, safe assess, closed-call rules never reject, real-data regression test.
- [x] Conversational Cost Planner with 3 scenarios, official cost references, saved versions, dashboard card.

## Cost Planner follow-ups
- [x] Gap round 1 (free tools): DE insurance + TUM fee; IT visa fee PKR; CN CSC stipend, visa-centre fee, Tsinghua/Fudan/Wuhan fees, Wuhan bank minimum.
- [ ] Remaining gaps need PDF reading (RWTH fee notice, Lombardy/Veneto DSU calls, Fudan tuition list): download-and-parse is free but needs your OK to download files; or a reviewer reads them by hand.
- [ ] Remaining: BLS study-visa service fee (site blocks bots), Islamabad Oct–Dec fee (not yet posted), Tsinghua UG tuition, national China bank minimum.
- [ ] Admin screen to review/edit `cost_references` (today: research/finance-sources.json → npm run refs:build).
- [ ] Optional: match tuition references to the chosen university automatically.
- [ ] Firecrawl credits are low — founder decides whether to top up before the next research round.
