-- Migration: Fix surcharge schema - remove location_id, update applies_scope
-- Date: 2024-01-19
-- Description: Simplify surcharge location handling to use only pol_id/pod_id

-- Step 1: Check if there's any data in location_id that we need to migrate
DO $$
BEGIN
    RAISE NOTICE 'Checking for data in location_id column...';
    
    -- Show records with location_id set
    IF EXISTS (SELECT 1 FROM surcharge WHERE location_id IS NOT NULL) THEN
        RAISE NOTICE 'Found records with location_id. Please review before proceeding:';
        RAISE NOTICE 'Count: %', (SELECT COUNT(*) FROM surcharge WHERE location_id IS NOT NULL);
    ELSE
        RAISE NOTICE 'No records with location_id found. Safe to proceed.';
    END IF;
END $$;

-- Step 2: Add new applies_scope values if not already present
-- First, check current CHECK constraint on applies_scope
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'surcharge'
AND con.contype = 'c'
AND con.conname LIKE '%applies_scope%';

-- Step 3: Drop existing CHECK constraint on applies_scope (if exists)
-- Note: You'll need to run this after confirming the constraint name above
-- ALTER TABLE surcharge DROP CONSTRAINT IF EXISTS surcharge_applies_scope_check;

-- Step 4: Add new CHECK constraint with correct values
-- ALTER TABLE surcharge 
-- ADD CONSTRAINT surcharge_applies_scope_check 
-- CHECK (applies_scope IN ('freight', 'origin', 'destination', 'other'));

-- Step 5: Drop location_id column (after confirming no critical data)
-- ALTER TABLE surcharge DROP COLUMN IF EXISTS location_id;

-- Step 6: Add helpful comment to clarify location logic
COMMENT ON COLUMN surcharge.pol_id IS 'Port of Loading - Used for origin/POL-level surcharges or POL-POD pairs';
COMMENT ON COLUMN surcharge.pod_id IS 'Port of Discharge - Used for destination/POD-level surcharges or POL-POD pairs';
COMMENT ON COLUMN surcharge.applies_scope IS 'Where charge applies: freight (ocean leg), origin (POL services), destination (POD services), other';

-- Location Logic:
-- Global surcharge: pol_id IS NULL AND pod_id IS NULL
-- POL-level surcharge: pol_id IS NOT NULL AND pod_id IS NULL
-- POD-level surcharge: pol_id IS NULL AND pod_id IS NOT NULL
-- POL-POD pair surcharge: pol_id IS NOT NULL AND pod_id IS NOT NULL

-- Step 7: Update existing data if needed (example - adjust based on your data)
-- Example: If you have records with old applies_scope values, map them:
-- UPDATE surcharge SET applies_scope = 'freight' WHERE applies_scope = 'pol_pod';
-- UPDATE surcharge SET applies_scope = 'origin' WHERE applies_scope = 'pol';
-- UPDATE surcharge SET applies_scope = 'destination' WHERE applies_scope = 'pod';

