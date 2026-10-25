-- How a record was verified: 'agent_evidence' (automated research with a verbatim official quote)
-- or 'human' (confirmed by a reviewer). NULL = not verified.
ALTER TABLE scholarships ADD COLUMN verification_method TEXT;
ALTER TABLE scholarships ADD COLUMN funding_class TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE scholarships ADD COLUMN monitor_url TEXT;

-- What a rule decides: applying for the award, university admission, selection, money, visa.
ALTER TABLE requirements ADD COLUMN scope TEXT NOT NULL DEFAULT 'scholarship_eligibility';
ALTER TABLE requirements ADD COLUMN fetch_method TEXT;

-- Work items for reviewers. dedupe_key keeps one open task per issue, so repeated job runs don't pile up.
CREATE TABLE review_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('source_changed','source_failing','deadline_passed','verify_record','error_report')),
  source_id TEXT,
  scholarship_id TEXT,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dismissed')),
  dedupe_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE UNIQUE INDEX idx_review_open ON review_tasks(dedupe_key) WHERE status = 'open';

-- Admin-issued, single-use password reset (no email provider yet). Only the token hash is stored.
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);
