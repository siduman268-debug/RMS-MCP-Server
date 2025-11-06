-- ==========================================
-- FIX DUPLICATE CARRIERS (CASE SENSITIVITY)
-- ==========================================
-- This script normalizes carrier names to uppercase and removes duplicates

-- Step 1: See duplicates
SELECT 
    UPPER(name) as normalized_name,
    COUNT(*) as count,
    ARRAY_AGG(name) as variants,
    ARRAY_AGG(id::text) as ids
FROM public.carrier
GROUP BY UPPER(name)
HAVING COUNT(*) > 1;

-- Step 2: For each duplicate group, keep the oldest one and update others to reference it
-- This is a manual process - you'll need to check which ID to keep

-- Step 3: Normalize all carrier names to uppercase
UPDATE public.carrier 
SET name = UPPER(TRIM(name));

-- Step 4: Add unique constraint on uppercase name (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'carrier_name_upper_unique'
    ) THEN
        ALTER TABLE public.carrier 
        ADD CONSTRAINT carrier_name_upper_unique 
        UNIQUE (UPPER(name));
    END IF;
END $$;

-- Step 5: Verify no duplicates
SELECT 
    name,
    COUNT(*) as count
FROM public.carrier
GROUP BY name
HAVING COUNT(*) > 1;

