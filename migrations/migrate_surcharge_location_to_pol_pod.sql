-- Migration: Migrate surcharge location_id to pol_id/pod_id
-- Date: 2024-01-19
-- Description: Consolidate location handling to use only pol_id/pod_id

BEGIN;

-- Step 1: Show current data distribution before migration
SELECT 
    applies_scope, 
    COUNT(*) as total,
    COUNT(location_id) as has_location_id,
    COUNT(pol_id) as has_pol_id,
    COUNT(pod_id) as has_pod_id
FROM surcharge
GROUP BY applies_scope
ORDER BY applies_scope;

-- Step 2: Migrate location_id to pol_id or pod_id based on applies_scope
-- For 'origin' and 'port' scope: location_id → pol_id
UPDATE surcharge
SET pol_id = location_id
WHERE applies_scope IN ('origin', 'port')
AND location_id IS NOT NULL
AND pol_id IS NULL;

-- For 'dest' (destination) scope: location_id → pod_id
UPDATE surcharge
SET pod_id = location_id
WHERE applies_scope = 'dest'
AND location_id IS NOT NULL
AND pod_id IS NULL;

-- For 'freight' scope with location_id: decide based on business logic
-- Option A: Treat as POL-level (origin of freight leg)
-- UPDATE surcharge
-- SET pol_id = location_id
-- WHERE applies_scope = 'freight'
-- AND location_id IS NOT NULL
-- AND pol_id IS NULL;

-- Option B: Keep freight surcharges global (do nothing, location_id will be dropped)
-- This is the default - freight surcharges are typically global

-- Step 3: Show data after migration
SELECT 
    applies_scope, 
    COUNT(*) as total,
    COUNT(location_id) as has_location_id,
    COUNT(pol_id) as has_pol_id,
    COUNT(pod_id) as has_pod_id
FROM surcharge
GROUP BY applies_scope
ORDER BY applies_scope;

-- Step 4: Update applies_scope constraint to use clearer values
-- Drop old constraint
ALTER TABLE surcharge DROP CONSTRAINT IF EXISTS surcharge_applies_scope_check;

-- Add new constraint with updated values
-- Keep 'origin', 'freight', 'other' as-is
-- Change 'dest' to 'destination' for clarity
-- Remove 'port' and 'door' (consolidate to origin/destination)
ALTER TABLE surcharge 
ADD CONSTRAINT surcharge_applies_scope_check 
CHECK (applies_scope IN ('origin', 'destination', 'freight', 'other'));

-- Step 5: Migrate old 'dest' to 'destination' and 'port' to 'origin'
UPDATE surcharge SET applies_scope = 'destination' WHERE applies_scope = 'dest';
UPDATE surcharge SET applies_scope = 'origin' WHERE applies_scope = 'port';
UPDATE surcharge SET applies_scope = 'other' WHERE applies_scope = 'door';

-- Step 6: Verify migration
SELECT 
    applies_scope, 
    COUNT(*) as total,
    COUNT(pol_id) as has_pol_id,
    COUNT(pod_id) as has_pod_id,
    -- Show location patterns
    SUM(CASE WHEN pol_id IS NULL AND pod_id IS NULL THEN 1 ELSE 0 END) as global_count,
    SUM(CASE WHEN pol_id IS NOT NULL AND pod_id IS NULL THEN 1 ELSE 0 END) as pol_only_count,
    SUM(CASE WHEN pol_id IS NULL AND pod_id IS NOT NULL THEN 1 ELSE 0 END) as pod_only_count,
    SUM(CASE WHEN pol_id IS NOT NULL AND pod_id IS NOT NULL THEN 1 ELSE 0 END) as pol_pod_pair_count
FROM surcharge
GROUP BY applies_scope
ORDER BY applies_scope;

-- Step 7: Drop location_id column (now redundant)
ALTER TABLE surcharge DROP COLUMN IF EXISTS location_id;

-- Step 8: Add helpful comments
COMMENT ON COLUMN surcharge.pol_id IS 'Port of Loading - for origin/POL-level surcharges or POL-POD pairs. NULL = not location-specific.';
COMMENT ON COLUMN surcharge.pod_id IS 'Port of Discharge - for destination/POD-level surcharges or POL-POD pairs. NULL = not location-specific.';
COMMENT ON COLUMN surcharge.applies_scope IS 'Supply chain stage: origin (POL services), destination (POD services), freight (ocean leg), other (misc)';

-- Step 9: Show final schema
\d surcharge

COMMIT;

-- Location Logic Reference:
-- ======================
-- Global surcharge: pol_id IS NULL AND pod_id IS NULL
-- POL-level (origin): pol_id IS NOT NULL AND pod_id IS NULL
-- POD-level (destination): pol_id IS NULL AND pod_id IS NOT NULL  
-- POL-POD pair: pol_id IS NOT NULL AND pod_id IS NOT NULL

