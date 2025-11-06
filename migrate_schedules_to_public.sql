-- ==========================================
-- MIGRATE SCHEDULES TABLES TO PUBLIC SCHEMA
-- ==========================================
-- This script moves all schedule-related tables from schedules schema to public schema
-- This allows Supabase client to access them directly without RPC functions

BEGIN;

-- Check if carrier view exists in public schema and drop it if it does
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'carrier'
    ) THEN
        DROP VIEW public.carrier CASCADE;
        RAISE NOTICE 'Dropped existing public.carrier view';
    END IF;
END $$;

-- Check for other conflicting tables/views in public schema
-- (vessel, service, voyage, facility, transport_call, port_call_time, schedule_source_audit)
DO $$
BEGIN
    -- Drop vessel if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vessel') THEN
        DROP TABLE public.vessel CASCADE;
        RAISE NOTICE 'Dropped existing public.vessel table';
    END IF;
    IF EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'vessel') THEN
        DROP VIEW public.vessel CASCADE;
        RAISE NOTICE 'Dropped existing public.vessel view';
    END IF;
    
    -- Drop service if exists (check view first, then table)
    IF EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'service') THEN
        DROP VIEW public.service CASCADE;
        RAISE NOTICE 'Dropped existing public.service view';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service') THEN
        DROP TABLE public.service CASCADE;
        RAISE NOTICE 'Dropped existing public.service table';
    END IF;
    
    -- Drop voyage if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voyage') THEN
        DROP TABLE public.voyage CASCADE;
        RAISE NOTICE 'Dropped existing public.voyage table';
    END IF;
    
    -- Drop facility if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'facility') THEN
        DROP TABLE public.facility CASCADE;
        RAISE NOTICE 'Dropped existing public.facility table';
    END IF;
    
    -- Drop transport_call if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transport_call') THEN
        DROP TABLE public.transport_call CASCADE;
        RAISE NOTICE 'Dropped existing public.transport_call table';
    END IF;
    
    -- Drop port_call_time if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'port_call_time') THEN
        DROP TABLE public.port_call_time CASCADE;
        RAISE NOTICE 'Dropped existing public.port_call_time table';
    END IF;
    
    -- Drop schedule_source_audit if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule_source_audit') THEN
        DROP TABLE public.schedule_source_audit CASCADE;
        RAISE NOTICE 'Dropped existing public.schedule_source_audit table';
    END IF;
END $$;

-- Move all schedule tables to public schema
ALTER TABLE schedules.carrier SET SCHEMA public;
ALTER TABLE schedules.vessel SET SCHEMA public;
ALTER TABLE schedules.service SET SCHEMA public;
ALTER TABLE schedules.voyage SET SCHEMA public;
ALTER TABLE schedules.facility SET SCHEMA public;
ALTER TABLE schedules.transport_call SET SCHEMA public;
ALTER TABLE schedules.port_call_time SET SCHEMA public;
ALTER TABLE schedules.schedule_source_audit SET SCHEMA public;

-- Update the RPC function to use public schema (or it will auto-detect)
-- The function already uses 'schedules.carrier' etc, so we need to update it
-- OR we can keep the function as-is and it will work with public schema

-- Note: If you have any views or functions that reference schedules.*, update them too

COMMIT;

-- Verify the move
SELECT 
    schemaname,
    tablename
FROM pg_tables
WHERE tablename IN (
    'carrier', 'vessel', 'service', 'voyage', 
    'facility', 'transport_call', 'port_call_time', 'schedule_source_audit'
)
ORDER BY schemaname, tablename;
