# Data model (D1 / SQLite) — see migrations/0001_init.sql

| Table | Purpose |
|---|---|
| users, sessions | Accounts (PBKDF2 hash+salt, role student/admin, consent time); sessions store SHA-256 of token |
| profiles | One JSON profile per user, validated by `shared/profile.ts` (all fields optional) |
| sources | Source registry: URL, authority, country, category, language, retrieval method, last check/success/review, `review_status` (discovered/reviewed/indexed/inaccessible/outstanding), content hash, fail count |
| source_checks | Every scheduled fetch: ok, HTTP status, hash, changed |
| scholarships | Opportunity record: country, provider, levels, applicant_type, coverage JSON, route, deadline (date only when checked) + deadline text as published, status (VERIFIED_OPEN … UNKNOWN), writing_policy, is_test_data, retrieved/verified timestamps, version |
| requirements | One row per material rule: machine rule JSON, English text, excerpt, original-language excerpt, source URL, applies_to, mandatory, review_status (VERIFIED/NEEDS_REVIEW/CONFLICTING), version |
| record_history | Snapshot of a scholarship/requirement before every admin change, with actor and reason |
| saved_scholarships | Student bookmarks |
| applications | Per-student trackers: mode, stage (planning→admitted/rejected), stage evidence, deadline + confirmed flag |
| tasks | Checklist items: type mandatory/conditional/recommended, applicable, due date + confirmed, source, depends_on, documents, **student_status** and separate **verified_status**, change_note |
| facts | Student fact bank used by the Writing Studio |
| writing_docs, writing_versions | Documents with policy mode, word limit, required sections, fact confirmation, full version history |
| error_reports | Student error reports → admin correction queue |
| notification_prefs, notifications | Per-type toggles, pause, weekly cap; notifications deduplicated by (user, dedupe_key) |
| packages | Configurable pricing |
| audit_log | Admin and account-deletion actions |
| rate_limits | Fixed-window counters for login/register/report |

Rule kinds (`shared/types.ts`): nationality, target_level, degree_completed, min_grade (scale-specific), max_age (as-of date),
language (any-of tests), max_gap_years, existing_scholarship, applicant_type, min_experience_years, field, manual.
Research-imported rules use `manual` until an admin structures and verifies them.
