-- South Korea: widen the country CHECK on scholarships and discoveries.
-- SQLite cannot alter a CHECK, so each table is rebuilt in place: copy its rows aside, drop it, recreate it under the
-- same name with the wider CHECK, copy the rows back. Renaming is avoided (it would rewire child foreign keys).
-- Dropping a parent performs an implicit DELETE that fires ON DELETE CASCADE on child tables (requirements,
-- saved_scholarships, error_reports), so their rows are copied aside first and restored afterwards. Children with
-- no ON DELETE action (applications) keep their rows; with deferred FK checks they are satisfied again once the
-- parent rows are re-inserted.
-- Rehearsed on a production backup: every table identical row-for-row before/after, foreign_key_check empty.
PRAGMA defer_foreign_keys = true;

CREATE TABLE _keep_requirements AS SELECT * FROM requirements;
CREATE TABLE _keep_saved_scholarships AS SELECT * FROM saved_scholarships;
CREATE TABLE _keep_error_reports AS SELECT * FROM error_reports;

CREATE TABLE _copy_scholarships AS SELECT * FROM scholarships;
DROP TABLE scholarships;
CREATE TABLE scholarships (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('CN','DE','IT','KR')),
  provider TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  official_url TEXT NOT NULL,
  levels TEXT NOT NULL DEFAULT '[]',
  applicant_type TEXT NOT NULL DEFAULT 'new' CHECK (applicant_type IN ('new','continuing','both')),
  funding_summary TEXT,
  coverage TEXT NOT NULL DEFAULT '{}',
  application_route TEXT,
  deadline_date TEXT,
  deadline_text TEXT,
  academic_year TEXT,
  status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK (status IN
    ('VERIFIED_OPEN','VERIFIED_UPCOMING','VERIFIED_CLOSED','CANCELLED','NEEDS_REVIEW','CONFLICTING_SOURCES','UNKNOWN')),
  writing_policy TEXT NOT NULL DEFAULT 'POLICY_UNCONFIRMED' CHECK (writing_policy IN
    ('DRAFTING_ALLOWED','EDITING_ONLY','COACHING_ONLY','POLICY_UNCONFIRMED')),
  is_test_data INTEGER NOT NULL DEFAULT 0,
  retrieved_at TEXT,
  last_verified_at TEXT,
  evidence_note TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
, verification_method TEXT, funding_class TEXT NOT NULL DEFAULT 'unknown', monitor_url TEXT, cycle_state TEXT NOT NULL DEFAULT 'unknown' CHECK (cycle_state IN ('open','upcoming','closed','unknown')), proposed_deadline TEXT, status_reason TEXT, source_checked_at TEXT, source_check TEXT);
INSERT INTO scholarships SELECT * FROM _copy_scholarships;
DROP TABLE _copy_scholarships;
CREATE INDEX idx_scholarships_country ON scholarships(country);

CREATE TABLE _copy_discoveries AS SELECT * FROM discoveries;
DROP TABLE discoveries;
CREATE TABLE discoveries (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  -- registered = host of a registered source; listed = curated official domain; pattern = university-style domain (reviewer checks)
  host_tier TEXT NOT NULL CHECK (host_tier IN ('registered','listed','pattern')),
  country TEXT CHECK (country IN ('CN','DE','IT','KR','PK')),
  title TEXT,
  kind TEXT NOT NULL DEFAULT 'unknown' CHECK (kind IN ('scholarship','programme','both','unknown')),
  provider TEXT NOT NULL,
  query TEXT,
  content_hash TEXT,
  fetched_at TEXT NOT NULL,
  http_status INTEGER,
  -- JSON: deadlines, fees, english (admission/scholarship), documents, levels, mentions. Every value carries a verbatim quote.
  extract TEXT NOT NULL,
  conflicts TEXT NOT NULL DEFAULT '[]',
  review_state TEXT NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK (review_state IN ('NEEDS_REVIEW','REVIEWER_CONFIRMED','REJECTED','CONFLICTING')),
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO discoveries SELECT * FROM _copy_discoveries;
DROP TABLE _copy_discoveries;
CREATE INDEX idx_discoveries_review ON discoveries(review_state, created_at);

INSERT INTO requirements SELECT * FROM _keep_requirements WHERE id NOT IN (SELECT id FROM requirements);
INSERT INTO saved_scholarships SELECT * FROM _keep_saved_scholarships WHERE (user_id, scholarship_id) NOT IN (SELECT user_id, scholarship_id FROM saved_scholarships);
INSERT INTO error_reports SELECT * FROM _keep_error_reports WHERE id NOT IN (SELECT id FROM error_reports);
DROP TABLE _keep_requirements;
DROP TABLE _keep_saved_scholarships;
DROP TABLE _keep_error_reports;
