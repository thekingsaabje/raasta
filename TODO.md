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

## URGENT (2026-10-25, end of session)
- [ ] Per-level rules (HEC degree, ANSO/MAECI age, Boell degree) are stored as all-mandatory. Live fix applied: closed-cycle verified rules + Boell degree rules demoted to NEEDS_REVIEW (manual SQL; mirror it in scripts/build-verification.mjs). Add a forLevels field to rules, a zod rule schema in the build script, try/catch around checkRule in assess, and a test that runs assess over the verification data. Then merge dev to main.
- [ ] Delete live e2e accounts after the background test run: DELETE FROM users WHERE email LIKE 'e2e-%@raasta.test'; and the E2E error report + review task.
