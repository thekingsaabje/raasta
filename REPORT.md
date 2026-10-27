# Raasta: session 6b, PDF calls and China sources (2026-10-27)

**Status: LIVE** (version `94a6a31c`). Backup: `backups/raasta-db-pre-pdf-china-2026-10-27.sql`. No schema change.

## What changed
- **Official PDF calls are read.** PDFs (≤ 5 MB) are converted to text by Cloudflare Workers AI Markdown Conversion (AI binding `AI`), then go
  through the same verbatim-quote extraction as web pages. Scanned or too-large PDFs say so. Results are labelled "official PDF read".
  Cloudflare docs: only *image* conversion uses AI models. On the Workers Free plan, usage beyond the daily allowance fails instead of being billed.
- **Admin → Discoveries → "Add evidence by pasting":** for official pages that block automated reading (campuschina.org and csc.edu.cn both return
  HTTP 412). The admin copies the text from the page in their own browser. Same official-host check, quotes only from the pasted text,
  starts NEEDS_REVIEW, labelled "text pasted by a Raasta reviewer". Pasted entries appear in searches for that country. Re-pasting resets the review.
- **Two readable official China sources** added (`seed/sources-2026-10-27.sql`, idempotent): Beihang CGS Bilateral Program (EN) and
  Peking University scholarships (EN). The Chinese Embassy in Pakistan site has no scholarship section; csc.edu.cn blocks bots.
- Open-web search and the official crawl now run in parallel and take turns for page slots (registered PDFs were crowded out before).
  Shorter timeouts: a search took 3–7 s live (was 9–56 s locally).

## Tests actually run
- `npm test`: **133/133** (+3: PDF read via a stand-in converter, scanned/no-converter PDF, admin paste flow).
- Real Cloudflare converter (REST API) on the Polimi 2027-28 merit call: 13,846 characters in 2.1 s; Raasta found
  "until 12:00 noon (Italian time) on December 15th 2026" → 15 Dec 2026 12:00 CET = **16:00 PKT**, with the opening date (1 Oct) not counted as a deadline.
  Note: local `wrangler dev` cannot reach the AI binding on this PC (proxy), so the binding was tested on the live site.
- Local browser test (built app): admin paste form, then a China search showing the pasted entry (31 Mar 2027 17:00 China time = 14:00 PKT) among 7 real pages.
- Live: `discover.spec.ts` **2/2**. A live Italy search read the Polimi PDF (15 Dec 2026, 16:00 PKT). CPU per search **53–114 ms** (all `ok`).
- Cleanup: 3 e2e users deleted. Live: 1 user, 39 sources, 14 discoveries (2 from PDFs) in NEEDS_REVIEW, 22/900 Tavily searches this month.

## Still limited
- campuschina.org / csc.edu.cn can't be read automatically (by design we don't bypass bot blocks), so China relies on university pages plus pasted evidence.
- Scanned PDFs (images) aren't read. CPU per search is above the Workers Free 10 ms guideline.
- Polimi's English requirement wasn't recognised from its wording (shown as "not stated"). The extractor's English patterns need widening.

---

# Raasta: session 6 report, live discovery (2026-10-27)

**Status: LIVE since 2026-10-27** (version `caf93f89`). Production was backed up (`backups/raasta-db-pre-discovery-2026-10-27.sql`), migration 0005 was rehearsed on a copy, then applied.
The Tavily key is set as a Worker secret (open-web search is on), with 8 of 900 searches used so far this month.

## What works now
- **Dashboard → Discover** (`/app/discover`, signed-in only). The student picks countries, a level and a field (prefilled from their profile),
  and Raasta reads official pages live and shows what each page says, **quoted word for word** with a link and the date it was read.
- **Search providers:** (1) the official-source crawl (registered sources plus same-site links, $0, always on); (2) Tavily open-web search,
  restricted to official domains, which switches on only when `TAVILY_API_KEY` is set. Every result passes an official-domain
  gate (registered / listed / university-style). Agents and forums are dropped and never fetched.
- **Five separate statuses per result:** eligibility (looks possible / needs confirmation / likely not for you, never "not eligible"),
  chances (never estimated), readiness (steps left), verification (not verified / reviewer checked / conflicting), and cycle.
- **Deadlines:** date as published, with opening date, time and timezone. Pakistan time is shown only when both time and zone are stated.
  An "X until Y" range is read as an opening date plus a deadline. Dates in tables without deadline wording are listed as "other dates", never as deadlines.
  dd/mm/yyyy is read day-first only on .it/.de/.pk sites.
- **English/MOI decision, admission and scholarship separately:** IELTS required / other tests / MOI accepted / waiver with approval /
  not stated / unclear or conflicting, with quotes, the student's score compared where the page gives a minimum, a backup-test step when a
  waiver needs approval, and email drafts (an MOI request to the registrar, a question to admissions). Raasta never writes certificates.
- **Fees:** total per currency for the programme length (one-time + yearly + semester + monthly). Amounts whose frequency isn't stated are excluded and listed.
  Scholarship benefits are shown as income, never subtracted from costs.
- **Document checklist:** what, why, issuer, how, translation, legalization, validity, format (as stated), fee (no invented numbers),
  upload, and deadline, plus the exact sentence where the page mentions it.
- **Timeline + next action:** counted back from the earliest upcoming deadline and labelled as Raasta planning dates.
- **Save to roadmap:** one `[Unverified lead]` application plus timeline and document tasks (idempotent, with a unique index).
- **Admin → Discoveries:** confirm that quotes were checked, mark conflicting, or reject (note required, audit logged). Rejected pages disappear for students.
  A reviewed page that changes returns to review automatically.
- **Limits:** 5 searches per student per day; ≤ 6 pages fetched per search; pages reused for 7 days; Tavily capped at 900 searches/month
  (hard stop reserved before each call), with search results cached for 7 days.

## Tests actually run
- `npm test`: **130/130** (97 earlier + 25 discovery unit + 8 discovery API). Covers profile matching, evidence (quotes must be verbatim;
  non-official domains dropped), unknown deadlines, conflicts (2 dates, MOI accepted vs rejected, page vs catalogue, rounds not conflicts),
  all six English states, fee totals, document checklist, timeline, save-to-roadmap idempotency, admin-only review, page changes after review,
  the Tavily quota stop, the cache, the search key never appearing in responses, and official links that redirect to non-official sites being skipped.
- Real official pages (read-only, a handful of fetches): Böll, UniPD, DAAD Pakistan, ER.GO, Tsinghua. All quotes were verbatim.
  Extraction took 1–4 ms per page warm (17 ms on the first cold call).
- Playwright `discover.spec.ts` locally against real pages: **2/2** (desktop 1440 + Pixel 7), with no sideways scroll on mobile.
- Full local Playwright: 24 passed, 4 failed. All 4 failures are caused by local data: the local `[TEST]` record was set to VERIFIED_OPEN in an earlier
  local admin test, which hides the TEST banner and changes catalogue order. No catalogue or scholarship-detail code changed this session.

## Live run (2026-10-27)
- `discover.spec.ts` against the live site: **2/2** (desktop + mobile) after one fix. The first live run found a real bug: two students
  searching the same page at the same moment, where the second one got an id that was never saved ("Not found"). Fixed (read back stored rows;
  the upsert keeps an unchanged page's review), with an API test that fails on the old code.
- CPU per search: **52–64 ms** (wall 3–9 s); opening/saving results: 1–5 ms. All requests completed (`outcome: ok`), but this is above
  the Workers Free 10 ms guideline, so heavy use may get searches cut off. Options: fewer pages per search, or Workers Paid ($5/month, needs approval).
- Cleanup: 4 e2e users deleted (founder is the only user). 5 discovered official pages remain in Admin → Discoveries (NEEDS_REVIEW).

## Provider credentials
- Tavily key: set by the founder in the git-ignored `.dev.vars`, uploaded as a Worker secret by piping from that file (never printed). One test search worked.

## Needs human review
- Every discovery starts as NEEDS_REVIEW (or CONFLICTING). Only Admin → Discoveries changes that.
- Document guidance is general (marked "the official call decides"). The Pakistan attestation wording is general and unverified for each call.
- Domain lists (`LISTED_DOMAINS`, university patterns) need the founder's review: every listed domain is trusted as official.
  I removed entries I couldn't confirm (jku.at, sssup.it, esu.pd.it, dsu.lombardia.it). Pattern hosts are labelled "reviewer checks".
- Document guidance has no dated sources yet (validity periods and fees say "check the call / provider" rather than giving numbers).

## Known limits
- PDFs aren't read automatically (many Italian calls are PDFs); the student is told to open the link.
- campuschina.org blocks bots, so China results are limited.
- Table layouts (e.g. ER.GO) give "other dates", not deadlines.
- Workers Free CPU: a cold first call took 17 ms locally. The deployed CPU time must be checked on the first live run.

Note for future live runs: sign-ups are limited to 20 per IP per hour. The discover test adds 2, so the full live suite may need to be split across two hours.

---

# Raasta — session 5 report: study-route journey and verification (2026-10-27)

## Summary
- The homepage's main button "Find my study route" now opens a step-by-step assessment at `/route`.
  "Browse scholarships" is the secondary option, and the catalogue preview moved below "how it works".
- The assessment asks one question at a time and adapts to the answers.
  - It asks about the student's situation, current studies (only if already abroad), countries, degree and intake, qualification, grades, gap, language, nationality/age and budget.
  - Back, Skip and editable answer chips work. Progress is kept in the browser and resumes on refresh.
- The results come from the database and deterministic rules (`shared/route.ts`). No AI and no probabilities are involved.
  - Each country shows its route, fit counts, a labelled cost estimate and possible barriers.
  - Each scholarship is placed in one of these groups: Verified fit, Potential fit (preliminary lead), Needs confirmation, Likely not eligible (needs confirmation), Not eligible, or Closed.
  - Each scholarship shows evidence (rules with quotes and sources), met/missing counts, next actions, "Add to roadmap" and "Plan exact costs".
- Saving needs an account. After sign-up the student returns to the results, the profile is saved, and a roadmap is created on the dashboard: applications with checklists, plus action tasks. The roadmap is created only once.
- `/costs` opens straight on its first question.
  - A banner offers to continue an earlier draft or start fresh.
  - Drafts started from `/route` skip the questions already answered.
  - No numbers are shown until there are costs to add up.
- **Verification policy (founder instruction): AI evidence never verifies a record.**
  - All 32 real records are now `NEEDS_REVIEW` in production. Research findings are kept separately as `cycle_state`, `proposed_deadline` and `status_reason`.
  - Students see labels such as "Looks open · not yet verified", "Status unknown" and "Conflicting information".
  - 0 rules on real records are verified, so an unverified rule can never reject a student.
  - Every record has a plain-English reason and an open review task.
- Admin review screen:
  - It shows the research evidence (what the official page appears to show, the proposed deadline and the reason) and the source link.
  - It has buttons to confirm open, upcoming or closed, or to mark sources as conflicting. The deadline is prefilled from the proposed one, and a reason is required.
  - It has a "Confirm all quoted rules" button.
  - Confirming sets `verification_method='human'` and closes the review task.

## Production changes (in this order)
1. Backup: `backups/raasta-db-pre-deploy-2026-10-27.sql`.
2. Rehearsal on a copy of that backup gave: 32 records NEEDS_REVIEW (12 look closed, 5 look open, 1 looks upcoming, 14 unknown), 0 verified rules, 32 open review tasks, 18 history snapshots and 0 records without a reason. A second run changed nothing.
3. Remote: migration `0004_cycle_state.sql`, then `seed/status-sync.sql`. The production counts matched the rehearsal exactly.
4. `npm.cmd run deploy`. The live site serves `assets/index-7tJBiEj-.js`, the same file as the build.

## Tests actually run
- `npm.cmd run typecheck`: clean. `npm.cmd test`: 97/97.
- Playwright, local: desktop 17/17 (route.spec re-run after the two fixes below) and mobile 9/9.
- Playwright, live (https://raasta.raasta.workers.dev): 26/26 on desktop and mobile (Pixel 7).
  - This includes the new `route.spec`: homepage button → adaptive question → refresh resumes → results with evidence and no percentages → "Add to roadmap" → sign-up → back to results → `/app` with exactly 1 application, and the profile saved.
  - The cost planner opens on its first question with no currency figures.
- Admin review screen: tested in a real browser **locally** on a `[TEST]` record. Confirm open needs a reason; it saved a new version, and the quoted rules were confirmed. No real production record was confirmed.
- Chrome walk on the live site at 1440×900, as the founder's existing session (no password typed, nothing saved to the account):
  - The homepage button opens `/route`.
  - The "studying in China" path asks about current studies, and the scholarship-holder path asks about renewal versus more funding.
  - Results show 0 potential, 5 need confirmation and 5 closed for China, with the labelled estimate. There were no console errors.
  - The test answers were then cleared from that browser.
  - The logged-out and signed-in student paths on live were covered by Playwright. A browser agent can't create live accounts with passwords.
- Cleanup: e2e users, the "E2E test report" error report and its task were deleted. Production now has 1 user and 0 orphan rows in applications, tasks, profiles, sessions, plans and documents.

## Bugs found and fixed this session
- Refreshing `/route` restarted the questions at step 1 (the answers were kept). It now resumes on the current question.
- After sign-up, the pending save could run twice and create duplicate applications. A guard and an early clear of the pending flag fixed this; the test checks for exactly 1 application.
- An FAQ answer still said records could be "automated"-verified. It is now rewritten.

## Known limits / blockers
- **No record is verified yet**, so "Verified fits" is always empty with an honest message. This only changes when the founder (admin) confirms records in Admin → Scholarships.
- The roadmap endpoint is idempotent for repeated calls, but two truly simultaneous calls could still race. The client now prevents this; a database unique index would close it fully (follow-up).
- In a background browser tab, step animations pause, so the question heading can lag behind. This doesn't happen in a visible tab.
- Costs: PKR 0. No paid services were used, no firecrawl credits were used this session, and payments remain off.

## Why each of the 32 real records is not verified (live, 2026-10-27)
All are `NEEDS_REVIEW`: AI research is evidence only, and a reviewer must confirm against the official page.

| # | Record | Official page shows | Proposed deadline | Why it is not verified |
|---|---|---|---|---|
| 1 | CAS-ANSO Scholarship (Degree Program) (`cn-cas-anso`) | Looks closed | 2026-01-31 | The official page shows the 2026/27 (2026 call) round has closed (deadline was 31 January 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 2 | Chinese Government Scholarship - Type A (HEC nomination, Pakistan) (`cn-cgs-type-a-hec`) | Looks closed | 2026-01-05 | The official page shows the 2026/27 round has closed (deadline was 5 January 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 3 | Chinese Government Scholarship Type B - Tsinghua University (graduate) (`cn-cgs-type-b-tsinghua`) | Looks closed | — | The official page shows the 2026/27 round has closed. Watch for the next call. A reviewer has not confirmed this yet. |
| 4 | Chinese Government Scholarship Type B - Zhejiang University (`cn-cgs-type-b-zju`) | Looks closed | 2025-12-31 | The official page shows the 2026/27 round has closed (deadline was 31 December 2025). Watch for the next call. A reviewer has not confirmed this yet. |
| 5 | Zhejiang Government Scholarship (new international postgraduates, ZJU) (`cn-zhejiang-gov-zju`) | Looks closed | 2026-02-28 | The official page shows the 2026/27 round has closed (deadline was 28 February 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 6 | DAAD Doctoral Programmes in Germany (`de-daad-doctoral-programmes`) | Looks closed | 2026-08-31 | The official page shows the 2027 (funding start) round has closed (deadline was 31 August 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 7 | DAAD Study Scholarships - Postgraduate Studies in Fine Art, Design, Visual Communication and Film (`de-daad-fine-art-design-film`) | Looks closed | 2026-10-15 | The official page shows the 2027/28 (funding from Oct 2027) round has closed (deadline was 15 October 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 8 | DAAD Research Grants in Germany (doctoral / early postdoc) (`de-daad-research-grants`) | Looks closed | 2026-08-31 | The official page shows the 2027 (funding start) round has closed (deadline was 31 August 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 9 | DiSCo Lazio Right to Study Scholarship (`it-disco-lazio-borsa`) | Looks closed | 2026-07-22 | The official page shows the 2026/27 round has closed (deadline was 22 July 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 10 | ER.GO Borsa di studio (Emilia-Romagna regional DSU scholarship) (`it-ergo-borsa`) | Looks closed | 2026-08-24 | The official page shows the 2026/27 round has closed (deadline was 24 August 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 11 | Invest Your Talent in Italy (IYT) (`it-invest-your-talent`) | Looks closed | 2026-05-11 | The official page shows the 2026/27 (11th edition) round has closed (deadline was 11 May 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 12 | MAECI Italian Government Scholarships for foreign students (`it-maeci`) | Looks closed | 2026-03-26 | The official page shows the 2026/27 round has closed (deadline was 26 March 2026). Watch for the next call. A reviewer has not confirmed this yet. |
| 13 | Tsinghua University International Undergraduate Freshmen Scholarship (`cn-tsinghua-ug-freshmen`) | Looks open | 2026-11-20 | The official page says the 2027/28 (2027 intake, first year) call is open until 20 November 2026. Our research quoted it word for word, but a Raasta reviewer has not confirmed it yet, so check the official page before relying on it. |
| 14 | DSU Toscana Borsa di studio 2026/27 - PhD and specialisation window (`it-dsu-toscana-phd`) | Looks open | 2026-11-16 | The official page says the 2026/27 call is open until 16 November 2026. Our research quoted it word for word, but a Raasta reviewer has not confirmed it yet, so check the official page before relying on it. |
| 15 | Politecnico di Milano Merit-Based International Scholarship - Gold (`it-polimi-gold`) | Looks open | 2026-12-15 | The official page says the 2027/28 call is open until 15 December 2026. Our research quoted it word for word, but a Raasta reviewer has not confirmed it yet, so check the official page before relying on it. |
| 16 | Politecnico di Milano Merit-Based International Scholarship - Platinum (`it-polimi-platinum`) | Looks open | 2026-12-15 | The official page says the 2027/28 call is open until 15 December 2026. Our research quoted it word for word, but a Raasta reviewer has not confirmed it yet, so check the official page before relying on it. |
| 17 | Politecnico di Milano Merit-Based International Scholarship - Silver (Cremona, Lecco, Mantova, Piacenza) (`it-polimi-silver`) | Looks open | 2026-12-15 | The official page says the 2027/28 call is open until 15 December 2026. Our research quoted it word for word, but a Raasta reviewer has not confirmed it yet, so check the official page before relying on it. |
| 18 | Beijing Government Scholarship (BGS) - Categories A/B/C (`cn-beijing-gov`) | Status unknown | — | The call covers three categories with different funding (A full, B no living costs, C tuition and insurance only) and gives no central deadline. |
| 19 | Chinese Government Scholarship (Bilateral / University Program) - CSC guide (`cn-cgs-csc-general`) | Status unknown | — | The CSC guide has no single deadline: each agency and university sets its own, so there is no date to confirm yet. |
| 20 | Shanghai Government Scholarship - Category A (Full) (`cn-shanghai-gov-a`) | Status unknown | — | The funding amounts are published only as an image we could not read, and each university sets its own dates. |
| 21 | Shanghai Government Scholarship - Category B (Partial) (`cn-shanghai-gov-b`) | Status unknown | — | The funding amounts are published only as an image we could not read, and each university sets its own dates. |
| 22 | DAAD Development-Related Postgraduate Courses (EPOS) (`de-daad-epos`) | Status unknown | — | Each course sets its own deadline; DAAD's list just says "see website of the course". |
| 23 | DAAD Helmut-Schmidt-Programme (Master's Scholarships for Public Policy and Good Governance) (`de-daad-helmut-schmidt`) | Status unknown | — | The deadline was missing from the official PDF we read, and the selection runs in Oct/Nov 2026, so this round has probably closed. |
| 24 | DAAD Study Scholarships for STEM Disciplines (`de-daad-stem`) | Status unknown | — | Pakistan is not in DAAD's country list for this programme. Likely not open to applicants from Pakistan. |
| 25 | DAAD Study Scholarships - Master Studies for All Academic Disciplines (`de-daad-study-all-disciplines`) | Status unknown | — | Pakistan does not appear in DAAD's country list for this programme and no current deadline is published. Likely not open to applicants from Pakistan. |
| 26 | Deutschlandstipendium (`de-deutschlandstipendium`) | Status unknown | — | Each university sets its own deadline; there is no single national date. |
| 27 | Friedrich-Ebert-Stiftung Scholarship for International Students (`de-fes`) | Status unknown | — | Aimed at students already studying in Germany; the dated deadlines on the programme pages were not checked. |
| 28 | KAAD Scholarship Programme 1 (`de-kaad-programme-1`) | Status unknown | — | Pakistan is not a KAAD focus country, so applications are accepted only in exceptional cases. No dates or amounts are published. |
| 29 | Konrad-Adenauer-Stiftung International Scholarship Program (`de-kas-international`) | Status unknown | — | Realistic mainly for students already in Germany with B2 German; no 2027 date is published. |
| 30 | International Talents @Unibo study grants (Master's) (`it-unibo-international-talents`) | Status unknown | 2025-05-30 | Only last year's (2025-26) official call was found; the current call was not. |
| 31 | Padua International Excellence Scholarship (`it-unipd-excellence`) | Status unknown | — | The next call (for 2027/28) is due in November 2026 and has not been published yet. |
| 32 | Heinrich Boell Foundation Scholarship (international Master's and PhD) (`de-boell`) | Looks upcoming | 2027-03-01 | The official page says the 2027/28 (Spring 2027 round) call opens later (deadline 1 March 2027). Our research quoted it, but a reviewer has not confirmed it yet. |

---

# Raasta — session 4 report: Cost Planner (2026-10-25)

Live: https://raasta.raasta.workers.dev/costs · Repo: https://github.com/thekingsaabje/raasta (`dev`, merged to `main` after live tests)

## What changed on /costs
- **Conversation, one question at a time** (11–12 steps):
  - Steps: destination → city/university → degree → duration → situation → scholarship situation → (awards to compare | your award letter) → tuition → housing → living → other costs → your funds.
  - Back, Skip, "Skip to results", and a clickable answer trail to edit earlier answers.
  - A running estimate updates as you answer.
  - The draft is kept in this browser only, with "Continue where you left off".
- **Three scenarios:**
  - **Without a scholarship:** always works.
  - **If awarded:** up to 3 catalogued awards, labelled "Potential — not awarded" and never added to your available money.
  - **With a confirmed award:** terms entered from the award letter. "Fully funded" counts for nothing unless the terms are documented.
- **For each scenario:**
  - programme cost, first-year cost and a typical year's cost;
  - what the award covers, by category, and what you still pay;
  - cash needed by stage (before applying, before the visa, before you fly, on arrival, during the first year);
  - available funds, funding gap, and a warning when your stated maximum contribution is exceeded.
- **Engine** (`shared/planner.ts`): deterministic, no AI.
  - One-time, monthly, per-semester and per-year costs; fees are counted per started semester or year.
  - Deposits are never double-counted: refundable means cash up front but not a cost; prepayment means already inside tuition or rent.
  - Stipends pay monthly costs only, the first month after arrival is unpaid, and shorter awards and partial waivers are supported.
- **Proof of funds** is a separate panel and is never added to costs. It shows the amount, route or period, accepted evidence, source and check date. Outdated or conflicting figures are collapsed under a warning.
- **Currency:** PKR, EUR, CNY and USD.
  - Indicative rates come from ExchangeRate-API's open endpoint with a visible date, cached for 12 hours.
  - You can enter your own rate.
  - With no rate, a figure is excluded and listed, never guessed.
- **Results tools:**
  - an assumptions editor (every line, duration and award term; results recalculate instantly);
  - an evidence summary ("Official figure / Official estimate / Your figure / Estimate / Unknown / Needs review");
  - "How we calculate"; a conclusion and next steps.
- **Sharing and saving:** export a Markdown summary (voluntary), print, and Start over.
- **Saved plans:**
  - Each save is a new version, and older versions can be loaded.
  - A plan can be linked to an application.
  - The server recalculates every saved plan itself; numbers sent by the browser aren't trusted.
- **Dashboard:**
  - A "Financial plan" card shows the scenario in use, what you still pay, the gap, cash before arrival, confirmed vs potential funding and unknown costs.
  - It's kept separate from application progress.
  - The funding actions include "Fill in unknown costs" and "Confirm costs on official pages".

## Official figures (research/finance-sources.json → `cost_references`)
- 70 figures:
  - 49 VERIFIED (verbatim quote from an official page, current period);
  - 15 official estimates (e.g. DAAD averages, university living guides);
  - 6 NEEDS_REVIEW.
  - By country: DE 26, IT 19, CN 21, PK 4.
- Key proof-of-funds figures:
  - **Germany:** €992 a month or €11,904 a year in a blocked account (German Embassy Islamabad, from 1 Jan 2025). The mission's older €11,208 PDF is marked "needs review".
  - **Italy:** €10,179.85 a year (Embassy of Italy Islamabad, checklist June 2026). The Oslo embassy's figure conflicts and is marked "needs review".
  - **China:** no official minimum found. The visa fee is 0 for ordinary Pakistani passports.
- When a figure is a range, the planner uses the **upper** end so the funding gap is never understated.
- **Gaps:**
  - Germany: no insurer student tariff; RWTH/TUM 2026/27 semester fees missing.
  - Italy: no PKR visa or service fee; regional DSU figures for Lombardy and Veneto missing.
  - China: no Campus China page; Tsinghua, Fudan and Wuhan fees not fetched; no minimum bank balance for self-funded students.
  - The CSC stipend figure is from an older cycle (needs review).
- **Firecrawl credits are running low** (research tool). Topping up is your decision; nothing was bought.

## Gap-filling round (free methods only, 2026-10-25)
- 23 more figures from official pages, read as raw page text in Chrome. Search was used only to find URLs. No Firecrawl, no paid tools.
- Live total: **93 figures — 64 verified, 16 official estimates, 13 needs review.**
- Filled:
  - **Germany:** TK statutory student health insurance from 1 Jan 2026 (€141.16 a month under 23, €146.29 from 23; €220.03 voluntary minimum afterwards); Studierendenwerk München fee for TUM, €97 a semester.
  - **Italy:** study visa fee in PKR, 16,250 (Karachi consulate, Oct–Dec 2026).
  - **China:**
    - CSC stipend straight from Campus China (CNY 2,500 / 3,000 / 3,500 a month).
    - Chinese visa centre service fee in Islamabad (PKR 13,200 regular, 19,800 express).
    - Tsinghua 2027 graduate tuition (CNY 33,000–40,000 a year); Fudan UIPE (CNY 400,000 for the whole programme).
    - Wuhan University: a USD 5,000 bank-statement minimum for graduate applicants. Its undated fee pages are marked "needs review".
- I re-checked three quotes containing "..." myself in Chrome:
  - The Italian visa fee and the Fudan total matched the official pages.
  - The Chinese visa-centre page now shows a "slide to verify" bot check, which I didn't bypass, so that figure relies on the researcher's earlier reading.
- When two official figures tie, the planner now pre-fills the higher one.
- Still missing:
  - **Germany:** RWTH 2026/27 semester fee (official notices are PDFs or broken links).
  - **Italy:** BLS service fee for study visas (site blocks access); Islamabad Oct–Dec fee (not posted yet); Lombardy/Veneto DSU amounts (PDF-only calls); a Study in Italy living-cost figure.
  - **China:** Tsinghua undergraduate tuition (table can't be matched to programmes); Fudan general tuition (PDF); dorms priced per night; a national minimum bank balance (no official source found).

## PDF round (approved downloads, free tools: curl + pdftotext)
- Downloaded 6 official PDFs: Padova 2026-27 regional scholarship call (EN), Polimi DSU 2026/27 call and supplement, Fudan 2026 postgraduate and undergraduate admission guides, and the RWTH student-parliament resolution. They went into a separate temporary folder that was deleted afterwards.
- Live total: **109 figures — 74 verified, 21 official estimates, 14 needs review.**
- Added:
  - **Veneto (Padova/ESU)**, full-time non-resident, 2026/27: €8,246 / €7,171.11 / €3,585.50 a year by income band. Students in ESU residences have €1,600 deducted for accommodation and €760 for meals. I read the table by column order and cross-checked it: the top band is the 15% uplift on 7,171.11, and the minimum is half of 7,171.11.
  - **Lombardy (Polimi)**, fuori sede in private housing, 2026/27: €8,248 / €7,172 / €5,857 a year including a free daily meal. A full-rate Polimi residence costs €5,240 a year; grant holders in residence have €2,847 deducted.
  - **Fudan 2026:**
    - Chinese-taught Master's: RMB 26,000 / 30,000 / 48,000 (liberal arts / science / medicine).
    - PhD science: RMB 37,000.
    - Undergraduate: RMB 23,000–42,000.
    - These are official estimates because Fudan says the fees are "for reference".
    - The guarantor must show a bank deposit of at least RMB 100,000 (an admission requirement, not a visa rule).
  - **RWTH:** only the Deutschlandsemesterticket part (€226.80 a semester from WS 2026/27). The full fee-rules PDF returned 403, and I didn't try to get around that, so this is "needs review".
- Scholarship amounts are stored as income, never as costs.
- The planner now compares figures per year when picking the higher of two equal-quality figures.
- Still missing: RWTH's full semester contribution, UniMi's 2026/27 DSU call (Polimi covers Lombardy), the BLS service fee, the Islamabad Oct–Dec fee, Tsinghua undergraduate tuition, and a national minimum bank balance for China.

## Eligibility safety fixes (carried over from last session)
- Rules can now be tied to a degree level (`forLevels`), e.g. HEC degree requirements, ANSO/MAECI age limits and Böll degree rules.
- Malformed rule data can't break a page. Every rule is validated (zod schema).
- Rules from closed calls never reject a student. Live: 47 verified rules (35 real), none on closed calls.
- Two wrong rejections fixed:
  - A student abroad applying elsewhere is no longer treated as "continuing".
  - "Can't be combined with another scholarship" is now a timing check, not a rejection.
- A regression test runs all real data through the eligibility engine for three typical students. The only rejections left are correct ones (wrong degree level).

## Tests actually run
- **Code (Vitest): 84/84 pass.** 16 planner tests use expected values I calculated by hand:
  - with and without a scholarship; full and partial tuition waivers; tuition-only awards;
  - stipends paid 10 of 12 months, starting after arrival; potential vs confirmed awards; a "fully funded" label with no terms;
  - durations of 18/24/36 months; unknown fees; missing rates; currency rounding;
  - refundable and prepaid deposits; insufficient funds; maximum contribution;
  - catalogue stipend-period mapping, a real bug caught by this testing.
  - Plus API tests for saving, versions, privacy between students, invalid input, the dashboard card and exchange-rate fallback.
- **Browser (Playwright, live site): 22/22** after the main deploy, and the 4 planner tests again after the final polish.
  - Desktop 1440×900 and mobile (Pixel 7, about 412 px wide).
  - Planner checks: the full conversation, hand-checked totals, instant recalculation, edit/back via the trail, currency switch, export download, Start over, saving two versions, the dashboard card and reopening from the dashboard.
- **By hand in your Chrome at 1440×900 (live):**
  - Walked an Italy Master's plan: the level-matched tuition list, the rent range, the visa fee pre-filled, two potential awards, the EUR switch (checked by hand) and resuming the draft.
  - No console errors; all API calls returned 200.
  - I didn't save, so nothing was added to your account, and I cleared my draft from your browser.
  - Not clicked in your Chrome: Print (it opens a system dialog) and Export (a file download). Both are covered by the browser tests.
- **Visual check script on live:** 8 public pages × 2 sizes, no problems.
- **Your Chrome can't shrink to 390 px**, so phone-size checks used Playwright and the built-in browser.

## Bugs found and fixed this session
1. A catalogue stipend was stored as `period` but read as `per`: a monthly stipend would have been counted as yearly.
2. Special characters were corrupted by a PowerShell edit (caught by tests, repaired).
3. Range figures were understated (lower end); now the upper end is used.
4. One tuition figure was offered for every degree level; now the list is level-matched.
5. Outdated proof-of-funds figures showed alongside current ones; now collapsed.
6. A German example city appeared for Italy; status badges overflowed in the award picker.
7. Live eligibility: wrong "not met" verdicts from per-level and closed-call rules.

## Not done / limits
- The rest of the site wasn't redesigned again this session; it keeps last session's design, and only the planner and dashboard got new UI.
- The planner doesn't yet take official fees by university automatically; you pick from the official options or enter your own.
- No automated accessibility audit (axe/Lighthouse).
- Print layout checked only through CSS rules, not on paper.

## Costs
Actual new spend: PKR 0. ExchangeRate-API open access is free with attribution. Cloudflare and GitHub are on free tiers. Firecrawl used existing credits, which are now low.

## Next steps
1. Confirm the auto-checked scholarships and the official cost figures in Admin.
2. Decide on Firecrawl credits before the next research round.
3. Fill the cost-figure gaps listed above.
4. Optional: an admin screen for cost references (today they're updated by the research script).
