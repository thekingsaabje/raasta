# Live discovery: architecture, gap report and plan

Status: **Approved ("do what is recommended and free") and built on `dev`, 2026-10-27.** Not deployed. Results are in REPORT.md (session 6).
Changes from the plan:
- No LLM at all (deterministic extraction only), so the Workers AI binding isn't needed.
- Discoveries keep their own review state instead of a review_tasks kind (that table has a CHECK constraint).
- The five separate statuses exist for discoveries only. The existing route assessment still uses the blended `Fit` (not split yet).
- PDFs are not read yet (the plan said ≤ 5 MB). Students are told to open the link.
- Admin "confirm" means "quotes checked". It does not promote a discovery into the catalogue yet.
- Document guidance has no dated sources yet. It avoids numbers and says "check the call / provider".

## 1. What exists and is reused

| Piece | Where | Reused for |
|---|---|---|
| Profile and journey (level, field, qualification, current country, holds scholarship) | `shared/profile.ts`, `/app/profile`, route draft | The input that discovery matches against |
| Deterministic eligibility engine (rules, `forLevels`, unverified NOT_MET → needs review) | `shared/eligibility.ts`, `shared/rules.ts` (zod) | Checks discovered requirements the same way as catalogue rules |
| Route evaluation and fit classes | `shared/route.ts`, `worker/route.ts` (`/api/route/evaluate`, `/api/me/roadmap`) | Results page and "save to roadmap" (already idempotent) |
| Sources registry and monitor (fetch, hash, failure count, review tasks, never changes status) | `worker/monitor.ts`, `sources` and `review_tasks` tables, cron every 4 h | The fetcher, the seed list of official domains, and the review queue |
| Human-only verification (`verification_method='human'`, evidence kept as `cycle_state`/`proposed_deadline`/quotes) | `SOURCE_POLICY.md`, admin review screens | Discoveries use the same rule: AI and pages never verify |
| Checklist and progress | `shared/checklist.ts`, `shared/progress.ts` | Base for the document checklist |
| Cost Planner (3 scenarios, official references, FX) | `shared/planner.ts`, `worker/planner.ts`, `cost_references` | Total-fee view per discovered programme |
| Tests: Vitest with a Node SQLite D1 shim, Playwright desktop + mobile | `tests/` | All new tests use the same setup |

**Not in the repo:** a "50 China records" set. Research holds 28 researched records (32 live real records) and 109 cost references. Nothing will be bulk-imported. Existing research stays internal source material.

## 2. Gaps

1. **No search provider.** The Worker only fetches known URLs (monitor and exchange rates). It cannot find new pages.
2. **Fit mixes three things.** `Fit` in `shared/route.ts` blends eligibility (`NOT_ELIGIBLE`), verification (`VERIFIED_FIT` vs `POTENTIAL_FIT`) and cycle (`CLOSED`). The pivot needs five separate fields: **eligibility, competitiveness, readiness, verification, cycle**. Plan: add the fields and keep `Fit` as a value derived from them, so the current assessment and roadmap keep working unchanged.
3. **No English-test or MOI model.** There is no structured requirement covering IELTS, alternative tests, MOI, waivers, or the "unknown / conflicting" states, and none checked separately for admission and for the scholarship.
4. **No discovery entity.** There is no table for a found programme or scholarship with its URL, verbatim quotes, proposed values, fetch timestamp, conflicts and review state.
5. **No document guidance model.** The checklist has tasks but not what/why/issuer/how/translation/legalization/validity/format/fee/upload/deadline.
6. **Deadlines have no timezone.** The plan stores the timezone exactly as published, or "timezone not stated". It never guesses one.
7. **No usage caps for paid or limited APIs.** The plan needs a hard monthly stop, caching and a per-user limit.

## 3. Search provider options (checked 2026-10-27)

| Option | What it can do | Cost | Needs from you | Source |
|---|---|---|---|---|
| **A. Official-domain crawl** (Worker fetch of the 37 registered sources plus links on those same domains) | Live, but **only finds awards on domains we already know**. This is bounded discovery, not open-web search. | $0 | Nothing | Existing code |
| **B. Tavily Search API** | Real open-web search, filterable to official domains | Free "Researcher" plan: 1,000 credits/month, no card; basic search = 1 credit. Paid from $30/month. | Create a Tavily account and give me the key **privately** (`wrangler secret put TAVILY_API_KEY`, never pasted in chat) | Third-party summaries dated Jul–Sep 2026 ([parallel.ai](https://parallel.ai/articles/best-free-web-search-api), [firecrawl.dev](https://www.firecrawl.dev/blog/tavily-pricing)). **Unverified on tavily.com itself — confirm on their pricing page when signing up.** |
| **C. Cloudflare Web Search API** (Ceramic) | Open-web search inside Cloudflare, zero data retention | $0.25 per 1,000 searches (Exa: $7 per 1,000). **No free tier.** Open beta. | Buying AI Gateway credits (a purchase) | Cloudflare docs, checked 2026-10-27 |
| **D. Brave Search API** | Open-web search | Sources conflict. Latest reports say $5/month free credit (about 1,000 queries) and a **card required**. | Account plus card | [apiserpent.com](https://apiserpent.com/blog/free-brave-search-api), [firecrawl.dev](https://www.firecrawl.dev/blog/brave-search-api-alternatives). **Unverified.** |
| Firecrawl (existing account) | Search plus scrape | Credits are low | Your top-up decision | Not used, per your rule |

Free helpers (no search, $0, confirmed in Cloudflare docs 2026-10-27):
- **Workers AI:** 10,000 neurons/day on the Free plan. When the allowance runs out, requests **fail with error 3036 and are not billed**. Free models include `@cf/zai-org/glm-4.7-flash`. Turning on the AI binding is a config change while `AI_ENABLED=false`, so it is listed here for your approval. It is optional (see §4).
- **Markdown Conversion** (HTML/PDF → text): part of Workers AI.
- **Browser Run:** 10 min/day free, for JavaScript-only pages. It returns a 429 error when the time runs out, with no bill.

**Recommendation: A now + B (Tavily free plan).** A works today at $0. B adds genuine open-web discovery at $0 and with no card. Both sit behind one `SearchProvider` interface, so C can replace B later without rework. Safeguards:
- hard stop at 900 searches a month, so usage never reaches pay-as-you-go
- results cached for 7 days per query
- 5 discovery runs per user per day

Estimate: about 3 searches per discovery run gives **about 300 student discovery runs a month** for free. Until you choose B or C, the product shows only "official-source crawl" results and labels them that way.

## 4. Evidence pipeline (search only proposes URLs)

1. **Query builder.** Profile + target country/level/field → 2–4 queries, restricted to official domains (Chinese, German and Italian university and government domains, DAAD, CSC, DSU bodies, HEC).
2. **Domain gate.** Keep only official hosts, using the `SOURCE_POLICY.md` hierarchy (provider → university → ministry). Agents, forums and directories are dropped.
3. **Fetch.** The Worker fetches each page itself (HTML via Markdown Conversion or text strip, PDFs ≤ 5 MB). It stores the fetch time and a hash.
4. **Extract.** Deterministic patterns first: dates, fees and currencies, IELTS/TOEFL/Duolingo/PTE scores, "medium of instruction", "waiver", document names, nationality lists. The LLM (optional, free tier) only proposes fields.
5. **Quote check.** Every proposed value must carry a quote that is an exact substring of the fetched text, or it is rejected. A missing value stays **"unknown"**, never a guess.
6. **Conflicts.** Two official pages that disagree → both quotes kept, state `CONFLICTING`.
7. **Store.** Each result becomes a row in `discoveries` (new migration 0005) with URL, quotes, proposed values, timestamps, conflicts and `review_state='NEEDS_REVIEW'`. It also opens one `review_tasks` row. **Nothing is ever verified automatically.**
8. **Show.** The student sees "Found on an official page · not yet verified" with the quote and link. They can save it to the roadmap, where the existing idempotent endpoint creates an application marked "unverified lead".

**English-test / MOI decision** (stored separately for **admission** and **scholarship**):
`IELTS_REQUIRED` · `ALTERNATIVE_TESTS` (with list and scores) · `MOI_ACCEPTED` · `WAIVER_WITH_APPROVAL` · `NOT_STATED` · `UNKNOWN_OR_CONFLICTING`.
For MOI, the student gets who issues it (their university registrar), how to request it, a request-email draft and what the letter must state. **Raasta never produces or fills in a certificate itself.**

**Document checklist:** each item lists what it is, why it is needed, who issues it, how to get it, translation, legalization (Apostille/consular, e.g. HEC + MOFA attestation in Pakistan), validity, format, fee, where to upload and the deadline. Anything not stated on an official page is shown as "not stated". Generic Pakistan steps (HEC, MOFA) come from a small curated table with dated sources, marked unverified until an admin confirms them.

**Deadlines:** exact published text, plus a parsed date, plus the timezone as published or "timezone not stated". The personal timeline counts back from the earliest deadline (documents, tests, attestation lead times). The next action is the first step not yet done.

## 5. The one end-to-end slice (first build)

**Master's in Germany and Italy for an applicant from Pakistan.** The Germany/Italy sources (DAAD, Heinrich Böll, Polimi, DSU Toscana and others) fetched cleanly in past monitor runs. China is a poor first slice for a fetch-based workflow because campuschina.org returns HTTP 412 to bots. China follows once the slice works.

Flow: `/discover` (or a step after the route assessment) → profile check → run discovery (provider A, plus B if approved) → results with the five separate fields → detail with English/MOI decision, document checklist, fees (linked to the Cost Planner), deadline with timezone and timeline → **Save to roadmap**. Admin → Review gets a "Discoveries" tab: accept into the catalogue (with written reason), reject, or mark conflicting.

The assessment, roadmap and Cost Planner are not changed except for the added fields.

## 6. Tests (one or more per item you listed)

Recorded official-page fixtures are used **only in tests**. The product never shows static results as live.

| Your item | Test |
|---|---|
| Profile matching | Unit: same discovery against bachelor-only, master-eligible and wrong-field profiles |
| Evidence | Unit: a quote not in the page text is rejected; a non-official domain is dropped |
| Unknown deadlines | Unit: no date on the page → "unknown", never a guessed date; no timezone → "timezone not stated" |
| Conflicts | Unit: two pages with different deadlines → `CONFLICTING` with both quotes |
| MOI alternatives | Unit: all six English/MOI states, separately for admission and scholarship |
| Total fees | Unit: application fee + tuition + deposit summed per scenario; unknown amounts excluded and listed |
| Document checklists | Unit: every field present or "not stated"; no certificate text produced |
| Saving to roadmap | API: save twice → one application, marked "unverified lead" |
| Live provider | One manual live run per provider, inside quota, result reviewed by hand |
| Regression | All existing 97 Vitest + 26 Playwright tests still pass |

## 7. Order of work after approval

1. Migration 0005 (`discoveries`, five status fields, deadline timezone), rehearsed locally first. Production: backup → rehearse → apply.
2. `shared/discovery.ts` (query builder, domain gate, extractors, quote check, English/MOI decision, document checklist) plus unit tests.
3. `worker/discovery.ts` (`SearchProvider` interface: crawl provider and Tavily provider with quota stop, cache, per-user limit) plus API tests.
4. UI: discover page, result detail, admin Discoveries tab. Playwright at 1440×900 and 390×844.
5. Report: what works, what needs your provider key, what needs human review. **Deploy only after you approve the report.**

## 8. What needs you

- **Choose a provider:** A only, A + B (Tavily free, your account and key), or A + C (Cloudflare, credit purchase).
- **Approve:** migration 0005 and turning on the Workers AI binding (free tier; it fails rather than bills).
- **Afterwards:** review discoveries in Admin. Only you can verify them.
