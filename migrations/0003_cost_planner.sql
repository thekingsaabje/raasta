-- Official cost figures and proof-of-funds rules. Proof-of-funds are requirements to SHOW money, not costs.
CREATE TABLE cost_references (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cost','proof_of_funds')),
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL,
  amount_max REAL,
  currency TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('once','month','semester','year')),
  applies_to TEXT,
  authority TEXT,
  source_url TEXT,
  excerpt TEXT,
  status TEXT NOT NULL CHECK (status IN ('VERIFIED','OFFICIAL_ESTIMATE','NEEDS_REVIEW')),
  checked_at TEXT,
  evidence_types TEXT,
  notes TEXT
);
CREATE INDEX idx_costref_country ON cost_references(country);

-- Saved financial assessments. Every save is a new version; plan_id groups versions of one plan.
CREATE TABLE fin_assessments (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  country TEXT,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  inputs TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (plan_id, version)
);
CREATE INDEX idx_fin_user ON fin_assessments(user_id, plan_id);

-- Cached indicative exchange rates (PKR per unit) with their source and publication time.
CREATE TABLE fx_rates (
  currency TEXT PRIMARY KEY,
  pkr_per REAL NOT NULL,
  source TEXT NOT NULL,
  rate_date TEXT,
  fetched_at TEXT NOT NULL
);
