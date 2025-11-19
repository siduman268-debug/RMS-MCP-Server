-- Comprehensive Haulage Tables Schema Analysis
-- This will help us understand the structure for tomorrow's implementation

-- 1. HAULAGE_ROUTE table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'haulage_route'
ORDER BY ordinal_position;

-- Check constraints for haulage_route
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'haulage_route';

-- Sample data from haulage_route
SELECT * FROM haulage_route LIMIT 5;

-- ============================================

-- 2. HAULAGE_RATE table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'haulage_rate'
ORDER BY ordinal_position;

-- Check constraints for haulage_rate
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'haulage_rate';

-- Sample data from haulage_rate
SELECT * FROM haulage_rate LIMIT 5;

-- ============================================

-- 3. HAULAGE_LEG table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'haulage_leg'
ORDER BY ordinal_position;

-- Check constraints for haulage_leg
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'haulage_leg';

-- Sample data from haulage_leg
SELECT * FROM haulage_leg LIMIT 5;

-- ============================================

-- 4. HAULAGE_RESPONSIBILITY table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'haulage_responsibility'
ORDER BY ordinal_position;

-- Check constraints for haulage_responsibility
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'haulage_responsibility';

-- Sample data from haulage_responsibility
SELECT * FROM haulage_responsibility LIMIT 5;

-- ============================================

-- 5. Check relationships between tables
SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('haulage_route', 'haulage_rate', 'haulage_leg', 'haulage_responsibility')
ORDER BY from_table, from_column;

-- ============================================

-- 6. Check enum types used in haulage tables
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%haulage%' OR t.typname IN (
    SELECT DISTINCT udt_name 
    FROM information_schema.columns 
    WHERE table_name IN ('haulage_route', 'haulage_rate', 'haulage_leg', 'haulage_responsibility')
    AND data_type = 'USER-DEFINED'
)
ORDER BY enum_name, enumsortorder;

-- ============================================

-- 7. Count records in each table
SELECT 'haulage_route' AS table_name, COUNT(*) AS record_count FROM haulage_route
UNION ALL
SELECT 'haulage_rate' AS table_name, COUNT(*) AS record_count FROM haulage_rate
UNION ALL
SELECT 'haulage_leg' AS table_name, COUNT(*) AS record_count FROM haulage_leg
UNION ALL
SELECT 'haulage_responsibility' AS table_name, COUNT(*) AS record_count FROM haulage_responsibility;

-- ============================================

-- 8. Check indexes on haulage tables
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('haulage_route', 'haulage_rate', 'haulage_leg', 'haulage_responsibility')
ORDER BY tablename, indexname;

-- ============================================

-- 9. Check tenant_id presence (multi-tenancy)
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('haulage_route', 'haulage_rate', 'haulage_leg', 'haulage_responsibility')
    AND column_name = 'tenant_id';

-- ============================================

-- 10. Sample join query to understand relationships
SELECT 
    hr.id AS route_id,
    hr.route_name,
    hrate.id AS rate_id,
    hrate.rate_amount,
    hleg.id AS leg_id,
    hleg.sequence_number,
    hresp.responsibility_type
FROM haulage_route hr
LEFT JOIN haulage_rate hrate ON hr.id = hrate.route_id
LEFT JOIN haulage_leg hleg ON hr.id = hleg.route_id
LEFT JOIN haulage_responsibility hresp ON hr.id = hresp.route_id
LIMIT 10;

