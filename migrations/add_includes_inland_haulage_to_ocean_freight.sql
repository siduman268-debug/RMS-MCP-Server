-- ============================================================================
-- Migration: Add includes_inland_haulage JSONB column to ocean_freight_rate
-- Purpose: Track if and how inland haulage is included in ocean freight pricing
-- Date: 2025-11-20
-- Related: HAULAGE_DUAL_RATE_STRUCTURE.md (3 carrier pricing models)
-- ============================================================================

-- Add the JSONB column to track inland haulage inclusion
ALTER TABLE ocean_freight_rate 
ADD COLUMN IF NOT EXISTS includes_inland_haulage JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN ocean_freight_rate.includes_inland_haulage IS 
'JSONB structure to track inland haulage inclusion in ocean freight rate.
Structure:
{
  "ihe_included": boolean,     -- Is Inland Haulage Export included?
  "ihi_included": boolean,     -- Is Inland Haulage Import included?
  "pricing_model": string,     -- "all_inclusive" | "inland_origin" | "gateway_port"
  "ihe_from_location": uuid,   -- If IHE included, from which inland point
  "ihi_to_location": uuid,     -- If IHI included, to which inland point
  "notes": string              -- Additional notes about the inclusion
}

Pricing Models:
1. all_inclusive: Door-to-door rate, IHE/IHI bundled in ocean rate (carrier handles inland)
2. inland_origin: Ocean rate from inland point + separate IHE charge (carrier uses inland as pricing point)
3. gateway_port: Traditional ocean rate from gateway port + separate IHE/IHI (customer arranges or pays separately)

Examples:
- NULL or {}: No inland haulage included (traditional port-to-port)
- {"ihe_included": true, "pricing_model": "all_inclusive", "ihe_from_location": "uuid"}: IHE bundled in rate
- {"ihe_included": false, "ihi_included": false, "pricing_model": "gateway_port"}: Traditional port-to-port
';

-- Create index for JSON queries on pricing_model
CREATE INDEX IF NOT EXISTS idx_ocean_freight_inland_pricing_model 
ON ocean_freight_rate ((includes_inland_haulage->>'pricing_model'));

-- Create index for JSON queries on ihe_included
CREATE INDEX IF NOT EXISTS idx_ocean_freight_ihe_included 
ON ocean_freight_rate ((includes_inland_haulage->>'ihe_included'));

-- Create index for JSON queries on ihi_included
CREATE INDEX IF NOT EXISTS idx_ocean_freight_ihi_included 
ON ocean_freight_rate ((includes_inland_haulage->>'ihi_included'));

-- Update existing records to NULL (explicitly no inland haulage)
-- This makes the schema change backward compatible
UPDATE ocean_freight_rate 
SET includes_inland_haulage = NULL 
WHERE includes_inland_haulage IS NULL;

-- ============================================================================
-- Example data insertions to demonstrate usage
-- ============================================================================

-- Example 1: Traditional port-to-port (NULL indicates no inland haulage)
-- No update needed, NULL is the default

-- Example 2: All-inclusive door-to-door from Sonipat to Mundra
-- UPDATE ocean_freight_rate 
-- SET includes_inland_haulage = jsonb_build_object(
--   'ihe_included', true,
--   'ihi_included', false,
--   'pricing_model', 'all_inclusive',
--   'ihe_from_location', 'f0828e63-a2f2-4742-b4b4-a9cc6851b42c',  -- Sonipat
--   'notes', 'Carrier includes ICD Sonipat to Mundra Port in ocean freight'
-- )
-- WHERE origin_code = 'INSON' AND destination_code = 'NLRTM';

-- Example 3: Inland origin pricing (ocean from INSON, IHE billed separately)
-- UPDATE ocean_freight_rate 
-- SET includes_inland_haulage = jsonb_build_object(
--   'ihe_included', false,
--   'ihi_included', false,
--   'pricing_model', 'inland_origin',
--   'ihe_from_location', 'f0828e63-a2f2-4742-b4b4-a9cc6851b42c',  -- Sonipat
--   'notes', 'Ocean rate from Sonipat, IHE charged separately'
-- )
-- WHERE origin_code = 'INSON' AND destination_code = 'NLRTM';

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Check column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'ocean_freight_rate' 
  AND column_name = 'includes_inland_haulage';

-- Check indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ocean_freight_rate' 
  AND indexname LIKE '%inland%';

-- Count rates by pricing model
SELECT 
  includes_inland_haulage->>'pricing_model' as pricing_model,
  COUNT(*) as count
FROM ocean_freight_rate
GROUP BY includes_inland_haulage->>'pricing_model'
ORDER BY count DESC;

-- Show rates with IHE included
SELECT 
  id, 
  origin_code, 
  destination_code,
  includes_inland_haulage
FROM ocean_freight_rate
WHERE includes_inland_haulage->>'ihe_included' = 'true'
LIMIT 10;

COMMIT;

