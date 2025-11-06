-- ==========================================
-- CHECK FOR CONFLICTING TABLES/VIEWS IN PUBLIC SCHEMA
-- ==========================================
-- Run this to see what tables/views exist in public schema that might conflict

-- Check for tables
SELECT 
    'TABLE' as object_type,
    schemaname,
    tablename as object_name
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN (
    'carrier', 'vessel', 'service', 'voyage', 
    'facility', 'transport_call', 'port_call_time', 'schedule_source_audit'
)
ORDER BY tablename;

-- Check for views
SELECT 
    'VIEW' as object_type,
    table_schema as schemaname,
    table_name as object_name
FROM information_schema.views
WHERE table_schema = 'public' 
AND table_name IN (
    'carrier', 'vessel', 'service', 'voyage', 
    'facility', 'transport_call', 'port_call_time', 'schedule_source_audit'
)
ORDER BY table_name;

-- Check for rate-related tables that might reference carrier
SELECT 
    'TABLE' as object_type,
    schemaname,
    tablename as object_name
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename LIKE '%rate%'
ORDER BY tablename;

