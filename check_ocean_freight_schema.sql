-- Check ocean_freight_rate table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ocean_freight_rate'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for CHECK constraints on ocean_freight_rate
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'ocean_freight_rate'
  AND con.contype = 'c'
ORDER BY con.conname;

-- Check for ENUM types used by ocean_freight_rate
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
    SELECT DISTINCT udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'ocean_freight_rate'
      AND data_type = 'USER-DEFINED'
)
ORDER BY t.typname, e.enumsortorder;

-- Check foreign keys
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'ocean_freight_rate'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

