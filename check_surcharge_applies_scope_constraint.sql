-- Check current applies_scope constraint
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'surcharge'
AND con.contype = 'c';

-- Check current applies_scope values in use
SELECT applies_scope, COUNT(*) as count
FROM surcharge
GROUP BY applies_scope
ORDER BY count DESC;

-- Check if location_id has any data
SELECT 
    COUNT(*) as total_records,
    COUNT(location_id) as records_with_location_id,
    COUNT(pol_id) as records_with_pol_id,
    COUNT(pod_id) as records_with_pod_id
FROM surcharge;

