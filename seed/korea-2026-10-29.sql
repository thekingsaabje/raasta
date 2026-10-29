-- South Korea: first two records, the Korean Government's Global Korea Scholarship (GKS, run by NIIED).
-- Evidence: Study in Korea (studyinkorea.go.kr, NIIED's official site), fetched as raw text on 2026-10-29 with curl;
-- every excerpt below appears word for word in that text. Research evidence only: both records stay NEEDS_REVIEW
-- until a reviewer confirms them. Pakistan's eligibility and the deadlines are in the official guidelines PDF,
-- which has not been read yet, so nothing here can rule a student in or out on those points.
-- Idempotent: INSERT OR IGNORE throughout. Requires migration 0007 (country 'KR').

INSERT OR IGNORE INTO sources (id, name, country, category, url, retrieval_method, review_status, notes)
VALUES ('kr-studyinkorea-gks', 'Study in Korea (NIIED): GKS scholarship programme', 'KR', 'scholarship_page',
        'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', 'monitor', 'discovered',
        'Official NIIED site. GKS programme overview: benefits, durations, tracks.');
INSERT OR IGNORE INTO sources (id, name, country, category, url, retrieval_method, review_status, notes)
VALUES ('kr-studyinkorea-notices', 'Study in Korea (NIIED): scholarship notices', 'KR', 'scholarship_page',
        'https://www.studyinkorea.go.kr/ko/notice/scholarshipsList.do?boardSort=3', 'monitor', 'discovered',
        'Official notice board where each year''s GKS guidelines and results are posted.');

INSERT OR IGNORE INTO scholarships (id, name, country, provider, source_id, official_url, levels, applicant_type, funding_summary, coverage,
  application_route, deadline_text, academic_year, status, funding_class, verification_method, is_test_data, retrieved_at, evidence_note,
  cycle_state, proposed_deadline, status_reason, updated_at)
VALUES ('kr-gks-undergraduate', 'Global Korea Scholarship (GKS) for Undergraduate Degrees', 'KR', 'NIIED (Government of Korea)', 'kr-studyinkorea-gks',
  'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', '["bachelor"]', 'new',
  'Airfare, Korean language training fees, tuition, and monthly allowances (official GKS page). One year of Korean language training, then the degree.',
  '{"tuition":true,"stipend":true,"travel":true}',
  'Embassy Track (through the Korean embassy in your country of residence) or University Track (directly to a GKS university).',
  'See the 2027 GKS-U Application Guidelines for each track''s deadline.', '2027', 'NEEDS_REVIEW', 'full', 'agent_evidence', 0, '2026-10-29',
  '[korea-research 2026-10-29] Raw text (curl) of the GKS overview and the notice board. 2027 GKS-U guidelines posted 2026-09-09 (English PDF 0914, not read). Pakistan eligibility, quota and deadlines are in the PDF.',
  'unknown', NULL,
  'The 2027 call was published on 9 September 2026. The deadline for each track is in the official guidelines, which Raasta hasn''t checked yet, so open the official notice for the date.',
  '2026-10-29T00:00:00.000Z');

INSERT OR IGNORE INTO scholarships (id, name, country, provider, source_id, official_url, levels, applicant_type, funding_summary, coverage,
  application_route, deadline_text, academic_year, status, funding_class, verification_method, is_test_data, retrieved_at, evidence_note,
  cycle_state, proposed_deadline, status_reason, updated_at)
VALUES ('kr-gks-graduate', 'Global Korea Scholarship (GKS) for Graduate Degrees', 'KR', 'NIIED (Government of Korea)', 'kr-studyinkorea-gks',
  'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', '["master","phd"]', 'new',
  'Airfare, Korean language training fees, tuition, and monthly allowances (official GKS page). Master''s 2 years, doctorate 3 years.',
  '{"tuition":true,"stipend":true,"travel":true}',
  'Embassy Track or University Track; see the year''s GKS-G guidelines.',
  'The 2027 GKS-G call has not been published yet.', '2027', 'NEEDS_REVIEW', 'full', 'agent_evidence', 0, '2026-10-29',
  '[korea-research 2026-10-29] Notice board: "2026 GKS-G Final Result Announcement" posted 2026-07-01; no 2027 GKS-G notice listed on 2026-10-29.',
  'closed', NULL,
  'The 2026 round has finished: final results were announced on 1 July 2026. The 2027 call isn''t on the official notice board yet, so watch it for the next round.',
  '2026-10-29T00:00:00.000Z');

-- Rules: quotes only. None is machine-decisive and none is verified, so they inform students but can't reject them.
INSERT OR IGNORE INTO requirements (id, scholarship_id, type, rule, text, excerpt, source_url, applies_to, mandatory, review_status, retrieved_at, scope, fetch_method) VALUES
 ('kr-gks-undergraduate-v1', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}', 'Covers airfare, Korean language training, tuition and a monthly allowance.',
  'Airfare, Korean language training fees, tuition, and monthly allowances', 'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'financial', 'curl-raw-text'),
 ('kr-gks-undergraduate-v2', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}', 'One year of Korean language training first, then a 4–6 year bachelor''s degree (or 2–3 year associate degree).',
  'Korean language training (1 year) + associate degree programs (2-3 years), bachelor''s degree programs (4-6 years)', 'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'financial', 'curl-raw-text'),
 ('kr-gks-undergraduate-v3', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}', 'Embassy Track: you apply through the Korean embassy or consulate in the country where you live.',
  'International students who apply through Korean embassies and consulates in their country of residence to pursue degree programs in various fields at GKS universities.', 'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', 'Embassy Track', 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'curl-raw-text'),
 ('kr-gks-graduate-v1', 'kr-gks-graduate', 'other', '{"kind":"manual"}', 'Covers airfare, Korean language training, tuition and a monthly allowance.',
  'Airfare, Korean language training fees, tuition, and monthly allowances', 'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'financial', 'curl-raw-text'),
 ('kr-gks-graduate-v2', 'kr-gks-graduate', 'other', '{"kind":"manual"}', 'Funding length: master''s 2 years, doctorate 3 years (after Korean language training).',
  'master''s degrees (2 years), doctoral degrees (3 years)', 'https://www.studyinkorea.go.kr/ko/plan/scholarship.do?tab=gks-tab1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'financial', 'curl-raw-text');

INSERT OR IGNORE INTO review_tasks (kind, scholarship_id, detail, dedupe_key, created_at) VALUES
 ('verify_record', 'kr-gks-undergraduate', 'New Korea record. Read the 2027 GKS-U Application Guidelines (English PDF, notice of 2026-09-09): confirm Pakistan eligibility per track, deadlines and quota, then confirm or correct.', 'verify_record:kr-gks-undergraduate:2026-10-29', '2026-10-29T00:00:00.000Z'),
 ('verify_record', 'kr-gks-graduate', 'New Korea record. 2026 round finished (results 2026-07-01). Confirm as closed and watch for the 2027 GKS-G guidelines.', 'verify_record:kr-gks-graduate:2026-10-29', '2026-10-29T00:00:00.000Z');
