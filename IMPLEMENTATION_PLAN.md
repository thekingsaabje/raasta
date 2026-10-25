# Implementation plan

| Milestone | Scope | Status (2026-10-25) |
|---|---|---|
| 1 Foundation | SPA, auth, private profiles, DB-backed dashboard, checklists, progress, admin access, migrations, tests, Cloudflare config | Built and tested locally; deployment waits on Cloudflare login |
| 2 Scholarship intelligence | Source registry, review queue, catalogue, evidence, coverage dashboard, research seed | Built; 24 sources / 28 records researched, all NEEDS_REVIEW |
| 3 Personalised guidance | Eligibility engine, gap analysis, cost planner, shortlist (Matches) | Engine + planner built; roadmaps basic (checklists) |
| 4 Writing & applications | Writing Studio with policy modes, fact bank, checks, versions; trackers with stages + evidence | Built (no LLM drafting; outline-from-facts only where allowed) |
| 5 Monitoring & ops | Scheduled source checks, change detection → review, correction queue, notifications | Cron + checker + queue built; email delivery and renewal calendar pending |
| 6 Commercial | Packages, entitlements, orders, payments | Packages configurable; entitlements/orders/payments not started (intentionally) |
| 7 Final QA | Visual, responsive, a11y, security, accuracy | Local QA done; repeat on deployed URL |

Order of next work: see TODO.md.
