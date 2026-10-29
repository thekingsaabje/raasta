-- Make three Pakistan exclusions machine-checkable (they were free-text "manual" rules the matcher ignored).
-- Idempotent: each statement only touches a rule that is still {"kind":"manual"}. Rules stay NEEDS_REVIEW, so
-- students see "Likely not eligible — needs confirmation" with the official quote until a reviewer confirms.
INSERT INTO record_history (entity, entity_id, version, snapshot, changed_by, reason, changed_at)
SELECT 'requirement', id, version, json_object('id', id, 'rule', rule, 'review_status', review_status), 'policy',
       'Exclusion made checkable from the quoted official list', datetime('now')
FROM requirements WHERE id IN ('de-daad-study-all-disciplines-v1', 'de-daad-stem-v1', 'it-maeci-v1') AND rule = '{"kind":"manual"}';
UPDATE requirements SET rule = '{"kind":"residence_excluded","countries":["PK"]}', version = version + 1
WHERE id IN ('de-daad-study-all-disciplines-v1', 'de-daad-stem-v1') AND rule = '{"kind":"manual"}';
UPDATE requirements SET rule = '{"kind":"nationality_excluded","countries":["PK"]}', version = version + 1
WHERE id = 'it-maeci-v1' AND rule = '{"kind":"manual"}';
