-- ==========================================
-- CHECK RATE TABLE DEPENDENCIES ON CARRIER
-- ==========================================
-- Check if rate table or other tables reference carrier

-- Check foreign key constraints
SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'carrier'
ORDER BY tc.table_name, kcu.column_name;

-- Check for rate-related tables
SELECT 
    schemaname,
    tablename,
    'Table' as object_type
FROM pg_tables
WHERE schemaname = 'public'
AND (tablename LIKE '%rate%' OR tablename LIKE '%carrier%')
ORDER BY tablename;

-- Check for views that reference carrier
SELECT 
    schemaname,
    viewname,
    'View' as object_type
FROM pg_views
WHERE schemaname = 'public'
AND (viewname LIKE '%rate%' OR viewname LIKE '%carrier%')
ORDER BY viewname;

