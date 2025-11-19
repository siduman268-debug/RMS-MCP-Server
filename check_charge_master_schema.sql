-- Check charge_master table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'charge_master'
ORDER BY ordinal_position;

-- Check if table exists at all
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'charge_master'
) as charge_master_exists;

