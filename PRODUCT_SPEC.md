# Product spec (summary)

Raasta answers five questions for Pakistani students heading to China, Germany or Italy:
1. What fits my qualifications? 2. Where are my eligibility gaps? 3. What will it really cost and what gap remains?
4. What documents, deadlines and steps? 5. How do I manage applications without paying a consultant for routine work?

## Journeys
- **A. Applying from Pakistan**: bachelor/master/PhD; equivalence, gaps, failed courses, language, route, costs.
- **B. Studying in China**: self-funded or partial award; university/municipal/provincial awards, renewals, transfers.
- **C. Studying in Germany/Italy**: continuing-student, regional (DSU) and institutional funding.
Continuing-student awards are never assumed open to new applicants and vice versa (`applicant_type`).

## Modules (status in HANDOFF.md)
Catalogue + evidence engine · profile + deterministic eligibility · cost/funding-gap planner · dashboard with
per-application tasks (student vs institution status kept separate) · Writing Studio with policy modes
(DRAFTING_ALLOWED / EDITING_ONLY / COACHING_ONLY / POLICY_UNCONFIRMED) · source registry, monitoring,
correction queue, version history · configurable packages (payments off).

## Application modes
Only **guided self-application** is offered. Assisted/managed modes are refused by the API until a real,
permitted service exists. Raasta never takes portal passwords or submits on a student's behalf.

## Pricing (hypotheses, configurable in `packages` table)
Free Explore PKR 0 · Fit 1,990 · Strategy 5,990 · Application Season 12,990 · Student Intelligence 2,490/semester.
Shown as "proposed"; not purchasable until features and a payment provider are ready.
