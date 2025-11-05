-- Get function definition for upsert_dcsa_schedule_v2
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname IN ('upsert_dcsa_schedule_v2', 'upsert_dcsa_schedule')
ORDER BY proname;

-- Alternative: Get more detailed info including parameter types
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname IN ('upsert_dcsa_schedule_v2', 'upsert_dcsa_schedule')
ORDER BY p.proname;

