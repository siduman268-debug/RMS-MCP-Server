-- Check charge_master table structure and data
SELECT * FROM charge_master LIMIT 20;

-- Check if charge_master has THC and other common codes
SELECT code, name FROM charge_master 
WHERE code IN ('THC', 'BAF', 'CAF', 'DOC', 'PSS', 'EBS', 'WRS')
ORDER BY code;

-- Count total charge codes
SELECT COUNT(*) as total_charge_codes FROM charge_master;

-- Show surcharge table foreign key constraint
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
WHERE tc.table_name = 'surcharge'
AND tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name = 'charge_code';

