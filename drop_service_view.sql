-- ==========================================
-- DROP SERVICE VIEW IN PUBLIC SCHEMA
-- ==========================================
-- Quick script to drop the service view if it exists

-- Check if service view exists
SELECT 
    table_schema,
    table_name,
    'View exists' as status
FROM information_schema.views
WHERE table_schema = 'public' 
AND table_name = 'service';

-- Drop the view
DROP VIEW IF EXISTS public.service CASCADE;

-- Verify it's dropped
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'service')
        THEN 'View still exists'
        ELSE 'View dropped successfully'
    END as status;

