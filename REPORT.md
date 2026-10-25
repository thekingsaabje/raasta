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
