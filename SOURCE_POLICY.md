# Source and evidence policy

## Hierarchy (decision-making authority first)
1. Official scholarship provider (CSC/Campus China, DAAD, MAECI, regional DSU bodies, foundations)
2. Official university / faculty / international office pages
3. Ministries, government agencies, embassies; HEC Pakistan for nomination routes
4. Formal written clarification from the responsible office
Forums, social media, agents and unofficial directories: **discovery only**, never evidence.

## Status rules
- New records enter as `NEEDS_REVIEW`. A page being reachable does not prove it is current.
- `VERIFIED_OPEN`/`VERIFIED_UPCOMING` require a checked deadline date (enforced by the API) and a human check of the current call's window and material rules.
- Conflicting sources (e.g. Chinese vs English) → keep both excerpts, set `CONFLICTING`/`CONFLICTING_SOURCES`.
- Deadline text is stored exactly as published; `deadline_date` is set only after verification.
- Paid reports (future): recheck material sources ≤72h before delivery, or disclose that it was not possible.

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
