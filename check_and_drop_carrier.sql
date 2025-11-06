-- ==========================================
-- CHECK AND DROP CARRIER VIEW IN PUBLIC SCHEMA
-- ==========================================
-- Run this first to check if carrier view exists and drop it safely

-- Check if carrier view exists in public schema
SELECT 
    table_schema,
    table_name,
    'View exists' as status
FROM information_schema.views
WHERE table_schema = 'public' 
AND table_name = 'carrier';

-- If the above query returns a row, then drop the view:
-- DROP VIEW public.carrier CASCADE;

-- Or run this to drop it automatically if it exists:
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'carrier'
    ) THEN
        DROP VIEW public.carrier CASCADE;
        RAISE NOTICE 'Dropped existing public.carrier view';
    ELSE
        RAISE NOTICE 'No carrier view found in public schema';
    END IF;
END $$;

