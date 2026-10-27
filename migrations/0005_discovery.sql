-- Live discovery: pages found on official sources for a student's profile.
-- A discovery is research evidence only. It never verifies anything; a reviewer decides in Admin → Discoveries.
CREATE TABLE discoveries (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  -- registered = host of a registered source; listed = curated official domain; pattern = university-style domain (reviewer checks)
  host_tier TEXT NOT NULL CHECK (host_tier IN ('registered','listed','pattern')),
  country TEXT CHECK (country IN ('CN','DE','IT','PK')),
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
CREATE INDEX idx_discoveries_review ON discoveries(review_state, created_at);

CREATE TABLE discovery_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The profile the search was run with, so cards, details and the roadmap all use the same answers.
  profile TEXT NOT NULL DEFAULT '{}',
  providers TEXT NOT NULL,
  queries TEXT NOT NULL,
  discovery_ids TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_discovery_runs_user ON discovery_runs(user_id, created_at);

-- Hard monthly stop for limited search APIs (never roll into pay-as-you-go).
CREATE TABLE search_usage (
  month TEXT NOT NULL,
  provider TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (month, provider)
);

CREATE TABLE search_cache (
  key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  results TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- A roadmap entry can come from a discovery instead of a catalogue record (unverified lead).
ALTER TABLE applications ADD COLUMN discovery_id TEXT REFERENCES discoveries(id);
CREATE UNIQUE INDEX idx_app_user_discovery ON applications(user_id, discovery_id) WHERE discovery_id IS NOT NULL;
