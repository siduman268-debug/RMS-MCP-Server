-- Check the vendor_type constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'vendor'::regclass
AND conname LIKE '%vendor_type%';

-- Also check if there's an ENUM type for vendor_type
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%vendor%'
ORDER BY e.enumsortorder;

