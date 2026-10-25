# Implementation plan

| Milestone | Scope | Status (2026-10-25, session 3) |
|---|---|---|
| 1 Foundation | SPA, auth, profiles, dashboard, checklists, admin, migrations, tests, deploy | Live; admin secured; backups + restore rehearsal |
| 2 Scholarship intelligence | Registry, catalogue, evidence, coverage, review queue | 32 real records, 18 auto-checked with verbatim quotes, 14 in review; review-task queue |
| 3 Personalised guidance | Eligibility (scopes + next actions), funding classes, cost planner, matches | Live |
| 4 Writing & applications | Writing Studio policy modes, trackers, stages with evidence | Live (no LLM drafting) |
| 5 Monitoring & ops | Cron, change detection, corrections, notifications | Cron verified on Cloudflare; reminders job not built |
| 6 Commercial | Packages, entitlements, payments | Packages only; payments intentionally off |
| 7 QA | Visual, responsive, journeys, security | Redesign v2; 7 journeys + security e2e; visual-check script; a11y audit pending |

Next: founder review of auto-checked records → reminders job → email provider decision → inventory expansion. See TODO.md.
