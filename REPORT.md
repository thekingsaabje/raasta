# Raasta — delivery report (2026-10-25)

## 1. Links
- **GitHub repo:** not created yet. GitHub CLI is not logged in (`gh auth login` waiting for the founder).
- **Deployed URL:** not deployed yet. Cloudflare CLI login timed out (`wrangler login` needs "Allow" in the browser).
- Code is safe locally in `Documents\Raasta`, branch `dev`, 3 commits.

## 2. What genuinely works (tested locally)
| Area | Working |
|---|---|
| Public site | Home, catalogue (search, country/level/applicant filters, compare 3), scholarship pages with per-rule evidence and source links, error reporting, pricing (payments off, prices marked "proposed"), cost planner, verification and privacy pages |
| Accounts | Sign-up with consent, login/logout, hashed sessions, rate limits, CSRF check, admin role |
| Profile & eligibility | Adaptive profile (3 journeys), deterministic rule engine: MET / NOT_MET / UNKNOWN / NEEDS_REVIEW; no scale conversion; unverified rules cannot reject |
| Dashboard | Progress ring, mandatory remaining, documents, saved/tracked, next 3 actions, upcoming dates, attention items, notifications |
| Applications | Checklist generated per scholarship, dependencies/blocking, student vs institution status, stages needing evidence, custom tasks, multiple independent applications |
| Writing Studio | Policy modes, fact bank, word-limit/section/grade-contradiction/wrong-institution/placeholder checks, versions, fact confirmation; outline only where drafting allowed. No LLM. |
| Admin | Coverage dashboard (sources / records / evidence measured separately), source registry + manual check, scholarship review with version history → linked tasks updated → students notified, rule verify/conflict, correction queue, audit log |
| Monitoring | Cron job (daily, ≤20 pages) hashes official pages, flags changes for review, marks repeat failures inaccessible. Verified in tests, **not yet on the live site**. |
| Privacy | JSON data export, account deletion (cascades), no uploads/bank statements/portal passwords |

## 3. Tests
- Unit + API (Vitest, real SQL via Node SQLite): **55/55 passed**. Covers eligibility edge cases, finance, progress, checklist, writing checks, auth, cross-user isolation, admin separation, rate limit, CSRF, deadline-change propagation, evidence for submitted stage, account deletion, source monitor, seed integrity.
- End-to-end (Playwright, desktop + mobile Chrome, local): **10/10 passed**.
- Not yet run against a deployed URL.

## 4. Scholarship coverage (measured, limited)
- 24 official sources (CN 8, PK 2, DE 6, IT 8), 1 inaccessible (EDISU Piemonte).
- 28 researched scholarship records + 2 clearly labelled `[TEST]` records.
- **0 records verified.** All real records are `NEEDS_REVIEW`; their rules are stored as text + excerpt, not yet machine-checkable, so the engine shows them as "needs review", never "met".
- Coverage is a starting inventory, not a complete one. Key open questions are listed in SOURCE_POLICY.md (Pakistan eligibility for Invest Your Talent, some DAAD programmes and MAECI).

## 5. Tools and integrations
- Used: Claude Code built-in browser (UI checks, reference site), Context7 docs (Cloudflare), a research subagent with web search, Playwright, Vitest.
- **No Claude Code plugins were investigated or installed** in this session. Nothing paid was used.

## 6. Hosting, database, costs
- Cloudflare Workers (static assets + Hono API) and D1. GitHub private repo planned. All free tiers. **Current cost: PKR 0.**
- Projected: free until about 100k requests/day. Workers Paid ($5/month) only if the CPU limit or traffic requires it — needs your approval.

## 7. Known limitations and risks
- Password hashing may exceed the free plan's per-request CPU limit. The work factor can be tuned without breaking accounts (HANDOFF step 5).
- No email verification or password reset yet, so admin is granted by a one-off database command, not by email.
- Privacy notice is a draft; legal review needed before real student data at scale.
- Bundle is ~146 KB gzipped (could be split). No CSP header yet.

## 8. Exact next steps
1. Founder: finish both logins (see chat).
2. Claude: create private repo `raasta`, push `dev`; create D1, migrate, seed (first time only), deploy to workers.dev; run e2e against the live URL; check CPU and cron.
3. Founder registers on the live site → Claude promotes the account to admin.
4. Verify the 28 records one by one in Admin → Scholarships (start with the open ones: Polimi, Heinrich Böll).
