-- Check what's in charge_master
SELECT charge_code, charge_name, charge_category, is_active 
FROM charge_master 
ORDER BY charge_code;

-- Check what charge codes are used in surcharge table vs what exists in charge_master
SELECT 
    s.charge_code, 
    COUNT(*) as usage_count,
    MAX(cm.charge_name) as master_name,
    CASE WHEN MAX(cm.charge_code) IS NOT NULL THEN 'YES' ELSE 'NO' END as exists_in_master
FROM surcharge s
LEFT JOIN charge_master cm ON s.charge_code = cm.charge_code
GROUP BY s.charge_code
ORDER BY usage_count DESC;

-- Find charge codes used in surcharge but missing from charge_master
SELECT DISTINCT s.charge_code
FROM surcharge s
LEFT JOIN charge_master cm ON s.charge_code = cm.charge_code
WHERE cm.charge_code IS NULL
ORDER BY s.charge_code;

