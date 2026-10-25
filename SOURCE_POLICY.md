# Source and evidence policy

## Hierarchy (decision-making authority first)
1. Official scholarship provider (CSC/Campus China, DAAD, MAECI, regional DSU bodies, foundations)
2. Official university / faculty / international office pages
3. Ministries, government agencies, embassies; HEC Pakistan for nomination routes
4. Formal written clarification from the responsible office
Forums, social media, agents and unofficial directories: **discovery only**, never evidence.

## Status rules
- New records enter as `NEEDS_REVIEW`. A page being reachable does not prove it is current.
- Two verification levels, always shown to students:
  - `agent_evidence` ("auto-checked"): Raasta research fetched the official page as raw text and quoted it verbatim,
    and the quote states the current cycle's dates/status. Model-summarised excerpts never count.
  - `human`: an admin confirmed it in the review screen (with a written reason, kept in history).
- `VERIFIED_CLOSED` = official page states a passed deadline for a named cycle and no newer call exists.
  `VERIFIED_UPCOMING`/`OPEN` need current-cycle dates on the official page (API enforces a checked date for human edits).
- Rules are `VERIFIED` (able to rule a student out) only when they come from a confirmed current cycle with a verbatim quote.
- Monitoring: every 4 hours (UTC :17, i.e. 08:17/12:17/… PKT) 6 sources are fetched; main content is hashed; a change or
  3 consecutive failures opens ONE review task. The monitor never changes statuses. Verified-open records past their
  deadline open a `deadline_passed` task.
- Conflicting sources (e.g. Chinese vs English) → keep both excerpts, set `CONFLICTING`/`CONFLICTING_SOURCES`.
- Deadline text is stored exactly as published; `deadline_date` is set only after verification.
- Paid reports (future): recheck material sources ≤72h before delivery, or disclose that it was not possible.

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
