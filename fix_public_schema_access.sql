-- Fix: Ensure port_call_time is accessed from public schema, not schedules
-- The error "permission denied for schema schedules" happens because
-- PostgreSQL checks schemas in search_path, and service_role needs permission
-- to check schedules schema even if the table is in public

-- 1. Grant USAGE permission on schedules schema to service_role
-- This allows PostgreSQL to check the schema without throwing permission errors
-- The table will still be found in public schema (which comes first in search_path)
GRANT USAGE ON SCHEMA schedules TO service_role;

-- 2. Ensure public schema has all necessary permissions for service_role
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. Also grant to authenticated and anon roles (if they're used)
GRANT USAGE ON SCHEMA schedules TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- 4. Verify permissions were granted
SELECT 
    nspname as schema_name,
    has_schema_privilege('service_role', nspname, 'USAGE') as service_role_usage
FROM pg_namespace
WHERE nspname IN ('public', 'schedules');

