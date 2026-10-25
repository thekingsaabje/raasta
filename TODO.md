# TODO (priority order)

## Needs the founder
- [x] Logins, private repo, D1, first deploy (2026-10-25).
- [ ] Confirm the 03:17 UTC cron ran on live (source_checks count > 5).
- [ ] Register on the live site, then Claude promotes that account to admin with a one-off D1 command (ADMIN_EMAILS stays unset in production until email verification exists).
- [ ] Decide on an email provider (Resend free tier) for verification/password reset/reminders — needs an account.
- [ ] Later: domain purchase; payment provider that supports a Pakistan business + PKR (verify before integrating).

## Data (highest value)
- [ ] Human-verify the 28 researched records against current official calls; structure their rules (replace `manual` with typed rules) and set checked deadline dates.
- [ ] Resolve flagged eligibility questions (IYT Italy, DAAD STEM/Master all disciplines, MAECI country list).
- [ ] Expand inventory: more Chinese provincial/municipal + top-50 university awards, German state schemes and Studienstiftung-type foundations, all Italian DSU regions.
- [ ] Gold-standard test library from real notices (expected eligibility for sample profiles).
- [ ] Continuing-student records (renewals, annual reviews) for China.

## Product
- [ ] Email verification + password reset; email reminders with weekly cap.
- [ ] Deadline reminder job (notifications for confirmed deadlines at 30/14/3 days) and renewal tracker.
- [ ] Roadmap view (timeline across applications); document library reuse across applications.
- [ ] Admin: create/edit scholarships and rules from the UI (today: seed + review only); source diff viewer.
- [ ] Entitlements + order records before any paid feature; refund/correction policy page.
- [ ] Optional AI explanations behind `AI_ENABLED` with spending cap (needs API key approval).

## Quality
- [ ] CSP header; admin 2FA; Lighthouse/axe accessibility pass; reduce JS bundle (code-split admin/app).
- [ ] Run Playwright against the deployed URL in CI (GitHub Actions free tier).
