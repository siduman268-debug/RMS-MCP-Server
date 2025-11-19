-- Check the mode constraint on margin_rule_v2
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'margin_rule_v2'
AND con.conname LIKE '%mode%';

-- Check existing mode values in use
SELECT mode, COUNT(*) as count
FROM margin_rule_v2
GROUP BY mode
ORDER BY count DESC;

