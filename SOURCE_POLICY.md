# Source and evidence policy

## Hierarchy (decision-making authority first)
1. Official scholarship provider (CSC/Campus China, DAAD, MAECI, regional DSU bodies, foundations)
2. Official university / faculty / international office pages
3. Ministries, government agencies, embassies; HEC Pakistan for nomination routes
4. Formal written clarification from the responsible office
Forums, social media, agents and unofficial directories: **discovery only**, never evidence.

## Status rules
- New records enter as `NEEDS_REVIEW`. A page being reachable does not prove it is current.
- Only people verify. A record becomes VERIFIED_* only when an admin confirms it in the review screen
  (`verification_method='human'`, written reason kept in history). An AI extraction or a reachable web page never
  verifies anything.
- Research evidence is kept separately and labelled as such: `cycle_state` (what the official page appears to show),
  `proposed_deadline` and `status_reason` (plain English), with verbatim quotes fetched as raw text
  (`verification_method='agent_evidence'`). Students see "Open · per official page" (wording the founder chose on
  2026-10-29); the assessment lists these records as potential fits, never as confirmed fits.
- Automatic quote check (`worker/quotecheck.ts`, cron): re-reads official pages and looks for every stored quote. Runs hourly,
  2 records per run, so each record is re-read daily. All quotes found and the deadline date (deadline_date or
  proposed_deadline, in common EN/DE/IT/ZH/KO formats) on the page → green "Auto-checked <date>" for 2 days (founder's
  choice 2026-10-29, separate from "Confirmed"). It proves the sentences are still there, not that a call is open; it never
  changes a status; missing quotes open a `source_changed` review task. A passed proposed deadline displays as closed.
- `VERIFIED_CLOSED` = official page states a passed deadline for a named cycle and no newer call exists.
  `VERIFIED_UPCOMING`/`OPEN` need current-cycle dates on the official page (API enforces a checked date for human edits).
- Rules are `VERIFIED` (able to rule a student out) only after an admin confirms the quote against the current official
  text. Unverified "not met" results are shown as "likely not eligible — needs confirmation", never as a rejection.
- Monitoring: every 4 hours (UTC :17, i.e. 08:17/12:17/… PKT) 6 sources are fetched; main content is hashed; a change or
  3 consecutive failures opens ONE review task. The monitor never changes statuses. Verified-open records past their
  deadline open a `deadline_passed` task.
- Conflicting sources (e.g. Chinese vs English) → keep both excerpts, set `CONFLICTING`/`CONFLICTING_SOURCES`.
- Deadline text is stored exactly as published; `deadline_date` is set only after verification (research dates go to `proposed_deadline`).
- Paid reports (future): recheck material sources ≤72h before delivery, or disclose that it was not possible.

## Live discovery
- Search providers only propose URLs. The Worker fetches each page itself, and only official hosts are used (registered source, listed official
  domain, or university/government-style domain marked "reviewer checks"). Agents, forums and directories are dropped before fetching.
- Every extracted value is a verbatim sentence from the fetched page; a page whose quotes don't match its text is skipped. Missing → "not stated" / unknown.
- Pages that block automated reading are never bypassed. An admin may paste text copied from the official page in their own browser;
  it is labelled "pasted by a Raasta reviewer" with the date and follows the same quote rules. PDFs are converted to text by Cloudflare and quoted the same way.
- Discoveries are NEEDS_REVIEW (or CONFLICTING). A reviewer confirming means "quotes checked against the live page", not catalogue verification.
  A page that changes after review returns to NEEDS_REVIEW.

## Cost and proof-of-funds figures (Cost Planner)
- Stored in `cost_references` from `research/finance-sources.json` (`npm run refs:build`). Status: VERIFIED (verbatim official quote,
  current period), OFFICIAL_ESTIMATE (an official average or guidance), NEEDS_REVIEW (outdated, other route or conflicting; shown collapsed).
- Proof-of-funds rules are requirements to SHOW money and are never added to costs. Scholarship benefits are income, never costs.
- Ranges prefill with the upper end. Student-entered figures are labelled "Your figure". Unknown amounts are excluded and listed.
- Exchange rates: ExchangeRate-API open access (indicative, dated, cached 12 h, attributed); students can override; no rate → no conversion.

## Coverage measurement
Three separate numbers on the admin dashboard: source inventory coverage, scholarship-record coverage, evidence completeness.
Never claim completeness; an absent record is not proof an award does not exist.

## Current inventory (2026-10-25)
24 official sources (CN 8, PK 2, DE 6, IT 8; 1 inaccessible: EDISU Piemonte) and 28 researched scholarship records,
all `NEEDS_REVIEW`. Research notes flagged for the reviewer:
- Invest Your Talent in Italy: official country list appears not to include Pakistan.
- DAAD STEM study scholarships / "Master Studies for All Academic Disciplines": Pakistan may not be eligible — check manually.
- MAECI eligible-country list for 2026-27 could not be read; Pakistan eligibility unverified.
- CSCA test now required for CGS bachelor applicants (CSC guide + HEC).
- Most 2026 cycles are closed; open/upcoming at research time: Polimi merit (15 Dec 2026), Heinrich Böll (15 Jan–1 Mar 2027).
- Most excerpts came via a summarising fetch tool and must be checked verbatim before verifying.
