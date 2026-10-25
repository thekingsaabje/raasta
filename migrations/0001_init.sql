-- Raasta initial schema. See DATA_MODEL.md for meaning of each table.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- One JSON profile per student; validated by shared/profile.ts before writing.
CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  authority TEXT,
  url TEXT NOT NULL,
  language TEXT,
  applicant_groups TEXT,
  retrieval_method TEXT NOT NULL DEFAULT 'manual',
  last_checked_at TEXT,
  last_success_at TEXT,
  last_reviewed_at TEXT,
  review_status TEXT NOT NULL DEFAULT 'discovered'
    CHECK (review_status IN ('discovered','reviewed','indexed','inaccessible','outstanding')),
  content_hash TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE source_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  http_status INTEGER,
  content_hash TEXT,
  changed INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE TABLE scholarships (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('CN','DE','IT')),
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
);
CREATE INDEX idx_scholarships_country ON scholarships(country);

-- Each material rule stored separately with its evidence.
CREATE TABLE requirements (
  id TEXT PRIMARY KEY,
  scholarship_id TEXT NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  rule TEXT NOT NULL,            -- machine-checkable JSON (shared/eligibility.ts)
  text TEXT NOT NULL,            -- English explanation
  excerpt TEXT,                  -- short quote from the official source
  original_excerpt TEXT,         -- original-language quote when not English
  source_url TEXT,
  applies_to TEXT,               -- applicant category / nationality / intake note
  mandatory INTEGER NOT NULL DEFAULT 1,
  review_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'
    CHECK (review_status IN ('VERIFIED','NEEDS_REVIEW','CONFLICTING')),
  retrieved_at TEXT,
  verified_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_requirements_sch ON requirements(scholarship_id);

CREATE TABLE record_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  changed_by TEXT,
  reason TEXT,
  changed_at TEXT NOT NULL
);

CREATE TABLE saved_scholarships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scholarship_id TEXT NOT NULL REFERENCES scholarships(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, scholarship_id)
);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scholarship_id TEXT REFERENCES scholarships(id),
  title TEXT NOT NULL,
  institution TEXT,
  mode TEXT NOT NULL DEFAULT 'guided' CHECK (mode IN ('guided','assisted','managed')),
  stage TEXT NOT NULL DEFAULT 'planning' CHECK (stage IN
    ('planning','prepared','reviewed','submitted','received','under_evaluation','admitted','rejected')),
  stage_evidence TEXT,
  deadline_date TEXT,
  deadline_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_applications_user ON applications(user_id);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  reason TEXT,
  requirement_type TEXT NOT NULL DEFAULT 'mandatory' CHECK (requirement_type IN ('mandatory','conditional','recommended')),
  applicable INTEGER NOT NULL DEFAULT 1,
  due_date TEXT,
  due_confirmed INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  source_verified_at TEXT,
  depends_on TEXT NOT NULL DEFAULT '[]',
  documents TEXT NOT NULL DEFAULT '[]',
  student_status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (student_status IN
    ('NOT_STARTED','IN_PROGRESS','COMPLETED_BY_STUDENT','SUBMITTED','BLOCKED','NEEDS_REVIEW')),
  verified_status TEXT NOT NULL DEFAULT 'NONE' CHECK (verified_status IN ('NONE','RECEIVED','VERIFIED','NEEDS_REVIEW')),
  next_action TEXT,
  change_note TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_app ON tasks(application_id);

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  evidence TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE writing_docs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  policy_mode TEXT NOT NULL DEFAULT 'POLICY_UNCONFIRMED',
  word_limit INTEGER,
  required_sections TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL DEFAULT '',
  facts_confirmed INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE writing_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL REFERENCES writing_docs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE error_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  scholarship_id TEXT REFERENCES scholarships(id) ON DELETE CASCADE,
  requirement_id TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','fixed')),
  resolution TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE notification_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  deadlines INTEGER NOT NULL DEFAULT 1,
  documents INTEGER NOT NULL DEFAULT 1,
  opportunities INTEGER NOT NULL DEFAULT 1,
  renewals INTEGER NOT NULL DEFAULT 1,
  paused INTEGER NOT NULL DEFAULT 0,
  max_per_week INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, dedupe_key)
);

CREATE TABLE packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_pkr INTEGER NOT NULL,
  period TEXT NOT NULL DEFAULT 'once',
  summary TEXT,
  features TEXT NOT NULL DEFAULT '[]',
  exclusions TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
