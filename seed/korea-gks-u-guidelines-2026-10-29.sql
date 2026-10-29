-- GKS Undergraduate 2027: evidence from the official guidelines PDF.
-- Source: "2027 GKS-U Application Guidelines (English) 0914.pdf", attached to Study in Korea notice nttId 4522
-- (posted 2026-09-09), downloaded 2026-10-29 with the founder's permission, 1,390,013 bytes,
-- sha256 de133f3fbcb626540deec0f8b6722d2cef10c80e14c6d318ac19c5003fc5fcd5. Text read with pdftotext; every excerpt
-- below appears word for word in it (whitespace collapsed). The PDF itself is not committed.
-- Research evidence only: status stays NEEDS_REVIEW; nothing is verified. Requires korea-2026-10-29.sql.
-- Idempotent: the record update runs once (marker in evidence_note) and never on a human-confirmed record;
-- new rules and tasks use INSERT OR IGNORE.

INSERT INTO record_history (entity, entity_id, version, snapshot, changed_by, reason, changed_at)
SELECT 'scholarship', id, 1,
       json_object('id', id, 'cycle_state', cycle_state, 'proposed_deadline', proposed_deadline, 'deadline_text', deadline_text,
                   'application_route', application_route, 'status_reason', status_reason, 'status', status),
       'policy', 'Evidence from the 2027 GKS-U guidelines PDF', datetime('now')
FROM scholarships
WHERE id = 'kr-gks-undergraduate' AND verification_method != 'human' AND evidence_note NOT LIKE '%[gks-u-pdf 2026-10-29]%';

UPDATE scholarships SET
  cycle_state = 'open',
  proposed_deadline = NULL,
  deadline_text = 'Embassy Track: closed 30 Sep 2026 (18:00 Korea time). University Track: September to November 2026, each university sets its own deadline.',
  application_route = 'Embassy Track: online through Study in Korea, recommended by the Korean embassy (Pakistan: 3 places). University Track: only the UIC programme (set science and engineering departments at 13 institutions, open to all countries) or the associate-degree programme; apply to ONE university and ONE department.',
  status_reason = 'The Embassy Track, which holds Pakistan''s 3 places, closed on 30 September 2026. The University Track runs from September to November 2026 on each university''s own schedule, and only for the UIC programme or associate degrees, so check the chosen university''s notice for its date.',
  evidence_note = evidence_note || ' [gks-u-pdf 2026-10-29] 2027 GKS-U guidelines PDF (notice 4522, sha256 de133f3f…) read: schedule, Pakistan quota, eligibility.',
  updated_at = '2026-10-29T00:00:00.000Z'
WHERE id = 'kr-gks-undergraduate' AND verification_method != 'human' AND evidence_note NOT LIKE '%[gks-u-pdf 2026-10-29]%';

-- Rules: quotes from the PDF. Only the age rule is machine-checkable (born on or after 1 March 2002 = at most 24
-- on 28 Feb 2027). Grades are an OR of three conditions and stay manual; grading scales are never converted.
INSERT OR IGNORE INTO requirements (id, scholarship_id, type, rule, text, excerpt, source_url, applies_to, mandatory, review_status, retrieved_at, scope, fetch_method) VALUES
 ('kr-gks-undergraduate-v4', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}',
  'Pakistan is one of the invited countries: 3 Embassy Track places in 2027 (2 General, 1 R-GKS).',
  '45 Pakistan 2 1 - 3', 'https://www.studyinkorea.go.kr/cmm/fms/FileDown.do?atchFileId=FILE_000000000673717&fileSn=1', 'Embassy Track', 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'pdftotext'),
 ('kr-gks-undergraduate-v5', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}',
  'Embassy Track online applications ran from 15 to 30 September 2026 (Korea time). That window has closed.',
  'September 15 (Tue.) 11:00-September 30 (Wed.) 18:00', 'https://www.studyinkorea.go.kr/cmm/fms/FileDown.do?atchFileId=FILE_000000000673717&fileSn=1', 'Embassy Track', 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'pdftotext'),
 ('kr-gks-undergraduate-v6', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}',
  'University Track: the UIC programme (named science and engineering departments at 13 institutions) is open to all countries. Applications run September to November 2026 on each university''s own schedule.',
  'UIC Program is open to all countries around the world', 'https://www.studyinkorea.go.kr/cmm/fms/FileDown.do?atchFileId=FILE_000000000673717&fileSn=1', 'University Track', 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'pdftotext'),
 ('kr-gks-undergraduate-v7', 'kr-gks-undergraduate', 'max_age', '{"kind":"max_age","max":24,"asOf":"2027-02-28"}',
  'You must be under 25: born on or after 1 March 2002.',
  'Must be under 25 years of age (born on or after March 1, 2002)', 'https://www.studyinkorea.go.kr/cmm/fms/FileDown.do?atchFileId=FILE_000000000673717&fileSn=1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'pdftotext'),
 ('kr-gks-undergraduate-v8', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}',
  'Grades: meet ONE of these: 80% or more, top 20% of your class, or CGPA at least 2.64/4.0 (or the equivalent on 4.3, 4.5 or 5.0 scales).',
  'A percentage score of 80 or above on a 100-point scale', 'https://www.studyinkorea.go.kr/cmm/fms/FileDown.do?atchFileId=FILE_000000000673717&fileSn=1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'pdftotext'),
 ('kr-gks-undergraduate-v9', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}',
  'If you already have a bachelor''s degree, you cannot apply.',
  'Applicants who have a bachelor''s degree cannot apply', 'https://www.studyinkorea.go.kr/cmm/fms/FileDown.do?atchFileId=FILE_000000000673717&fileSn=1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'pdftotext'),
 ('kr-gks-undergraduate-v10', 'kr-gks-undergraduate', 'other', '{"kind":"manual"}',
  'Still in your final year? You can apply, but if you pass the first round you must send your graduation certificate and transcript by 31 December 2026.',
  'must submit a graduation certificate (or a degree certificate) and a transcript by December 31, 2026', 'https://www.studyinkorea.go.kr/cmm/fms/FileDown.do?atchFileId=FILE_000000000673717&fileSn=1', NULL, 1, 'NEEDS_REVIEW', '2026-10-29', 'scholarship_eligibility', 'pdftotext');

INSERT OR IGNORE INTO review_tasks (kind, scholarship_id, detail, dedupe_key, created_at) VALUES
 ('verify_record', 'kr-gks-undergraduate', 'Re-check in early December 2026: the University Track closes "by November" on each university''s own schedule, and the record has no single deadline to close it automatically. Set it to closed once the University Track ends; final results are expected 7 Jan 2027.', 'verify_record:kr-gks-undergraduate:2026-12-recheck', '2026-10-29T00:00:00.000Z');
