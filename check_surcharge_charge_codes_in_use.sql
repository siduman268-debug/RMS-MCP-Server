-- Check what charge codes are currently used in surcharge table
SELECT 
    charge_code, 
    COUNT(*) as usage_count,
    -- Check if it exists in charge_master
    EXISTS(SELECT 1 FROM charge_master WHERE code = surcharge.charge_code) as exists_in_master
FROM surcharge
GROUP BY charge_code
ORDER BY usage_count DESC;

