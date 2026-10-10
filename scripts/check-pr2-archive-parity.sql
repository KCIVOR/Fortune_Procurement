-- Read-only regression: returns no rows when both archive column/type sets match.
WITH live AS (
 SELECT replace(table_name, 'pr2_', '') AS kind, column_name, udt_name
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('pr2_requests','pr2_items')
), archived AS (
 SELECT replace(replace(table_name, '_archive', ''), 'pr2_', '') AS kind, column_name, udt_name
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('pr2_requests_archive','pr2_items_archive')
)
SELECT 'missing_or_wrong_archive' AS failure, * FROM (TABLE live EXCEPT TABLE archived) a
UNION ALL
SELECT 'extra_or_wrong_archive' AS failure, * FROM (TABLE archived EXCEPT TABLE live) a;
