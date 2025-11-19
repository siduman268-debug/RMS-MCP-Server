-- Migration: Add missing charge codes to charge_master
-- Date: 2024-01-19
-- Description: Add standard charge codes that are in LWC dropdown but missing from charge_master

-- Insert missing charge codes
INSERT INTO charge_master (charge_code, charge_name, charge_category, description, default_calc_method, default_uom, is_active)
VALUES
    -- THC (generic) - can be used for both origin and destination
    ('THC', 'Terminal Handling Charge', 'PORT', 'Generic terminal handling charge at port', 'flat', 'per_cntr', true),
    
    -- Standard freight surcharges
    ('AMS', 'Automated Manifest System', 'DOCUMENTATION', 'US AMS filing fee', 'flat', 'per_bl', true),
    ('ENS', 'Entry Summary Declaration', 'DOCUMENTATION', 'EU ENS filing fee', 'flat', 'per_bl', true),
    ('ISPS', 'International Ship and Port Facility Security', 'SECURITY', 'ISPS security charge', 'flat', 'per_cntr', true),
    ('SEC', 'Security Surcharge', 'SECURITY', 'General security surcharge', 'flat', 'per_cntr', true),
    ('WRS', 'War Risk Surcharge', 'FREIGHT', 'War risk surcharge for high-risk areas', 'flat', 'per_cntr', true),
    
    -- Additional common charges
    ('CIC', 'Container Imbalance Charge', 'FREIGHT', 'Charge for container repositioning', 'flat', 'per_cntr', true),
    ('DDC', 'Destination Delivery Charge', 'DESTINATION', 'Delivery charge at destination', 'flat', 'per_cntr', true),
    ('ORC', 'Origin Receiving Charge', 'ORIGIN', 'Receiving charge at origin', 'flat', 'per_cntr', true),
    ('BUC', 'Bunker Charge', 'FREIGHT', 'Alternative bunker adjustment', 'flat', 'per_cntr', true),
    ('DOC', 'Documentation Fee', 'DOCUMENTATION', 'General documentation fee (short form)', 'flat', 'per_bl', true),
    
    -- Catch-all
    ('OTHER', 'Other Charges', 'OTHER', 'Miscellaneous charges not categorized', 'flat', 'per_cntr', true)
    
ON CONFLICT (charge_code) DO NOTHING;

-- Verify inserted charge codes
SELECT charge_code, charge_name, charge_category, is_active
FROM charge_master
WHERE charge_code IN ('THC', 'AMS', 'ENS', 'ISPS', 'SEC', 'WRS', 'CIC', 'DDC', 'ORC', 'BUC', 'DOC', 'OTHER')
ORDER BY charge_code;

