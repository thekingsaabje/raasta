-- Separate "what the official page appears to say" from "what a reviewer has confirmed".
-- status stays NEEDS_REVIEW until an admin confirms; cycle_state / proposed_deadline hold the research evidence.
ALTER TABLE scholarships ADD COLUMN cycle_state TEXT NOT NULL DEFAULT 'unknown' CHECK (cycle_state IN ('open','upcoming','closed','unknown'));
ALTER TABLE scholarships ADD COLUMN proposed_deadline TEXT;
-- Plain-English reason shown to students when a record is not reviewer-confirmed.
ALTER TABLE scholarships ADD COLUMN status_reason TEXT;
