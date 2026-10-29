-- Automatic official-page check: re-reads the official page and looks for the stored word-for-word quotes.
-- Evidence only. It never changes a scholarship's status; a missing quote opens a review task.
ALTER TABLE scholarships ADD COLUMN source_checked_at TEXT;
-- JSON: {"result":"matches"|"partly"|"changed"|"unreadable","found":n,"total":n}
ALTER TABLE scholarships ADD COLUMN source_check TEXT;
