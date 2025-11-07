-- ============================================
-- MIGRATION: Add Origin/Destination Columns
-- Purpose: Add origin_code and destination_code columns to support V4 APIs
--          and future routing perspective (pol/pod for routing)
-- Date: 2025-01-17
-- ============================================

BEGIN;

-- ============================================
-- Step 1: Add columns to ocean_freight_rate table
-- ============================================

ALTER TABLE ocean_freight_rate 
  ADD COLUMN IF NOT EXISTS origin_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS destination_code VARCHAR(10);

-- Add comments to clarify purpose
COMMENT ON COLUMN ocean_freight_rate.origin_code IS 
  'Origin port UN/LOCODE - where cargo originates (for V4 APIs)';
COMMENT ON COLUMN ocean_freight_rate.destination_code IS 
  'Destination port UN/LOCODE - where cargo is delivered (for V4 APIs)';
COMMENT ON COLUMN ocean_freight_rate.pol_id IS 
  'Port of Loading ID - routing perspective (may differ from origin for inland)';
COMMENT ON COLUMN ocean_freight_rate.pod_id IS 
  'Port of Discharge ID - routing perspective (may differ from destination for inland)';

-- ============================================
-- Step 2: Copy existing data from locations table
-- ============================================

UPDATE ocean_freight_rate ofr
SET 
  origin_code = COALESCE(
    ofr.origin_code,  -- Keep if already set
    (SELECT unlocode FROM locations WHERE id = ofr.pol_id)
  ),
  destination_code = COALESCE(
    ofr.destination_code,  -- Keep if already set
    (SELECT unlocode FROM locations WHERE id = ofr.pod_id)
  )
WHERE origin_code IS NULL OR destination_code IS NULL;

-- ============================================
-- Step 3: Verify data was copied correctly
-- ============================================

DO $$
DECLARE
  total_count INTEGER;
  origin_count INTEGER;
  dest_count INTEGER;
  missing_origin INTEGER;
  missing_dest INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM ocean_freight_rate;
  SELECT COUNT(origin_code) INTO origin_count FROM ocean_freight_rate;
  SELECT COUNT(destination_code) INTO dest_count FROM ocean_freight_rate;
  SELECT COUNT(*) INTO missing_origin FROM ocean_freight_rate WHERE origin_code IS NULL;
  SELECT COUNT(*) INTO missing_dest FROM ocean_freight_rate WHERE destination_code IS NULL;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  Total rates: %', total_count;
  RAISE NOTICE '  Has origin_code: %', origin_count;
  RAISE NOTICE '  Has destination_code: %', dest_count;
  RAISE NOTICE '  Missing origin_code: %', missing_origin;
  RAISE NOTICE '  Missing destination_code: %', missing_dest;
  
  IF missing_origin > 0 OR missing_dest > 0 THEN
    RAISE WARNING 'Some rates are missing origin_code or destination_code. Check pol_id/pod_id relationships.';
  END IF;
END $$;

-- ============================================
-- Step 4: Add NOT NULL constraints (after data is populated)
-- ============================================

-- Only add NOT NULL if all rows have values
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count 
  FROM ocean_freight_rate 
  WHERE origin_code IS NULL OR destination_code IS NULL;
  
  IF missing_count = 0 THEN
    ALTER TABLE ocean_freight_rate 
      ALTER COLUMN origin_code SET NOT NULL,
      ALTER COLUMN destination_code SET NOT NULL;
    RAISE NOTICE 'Added NOT NULL constraints to origin_code and destination_code';
  ELSE
    RAISE WARNING 'Cannot add NOT NULL constraints - % rows have NULL values', missing_count;
  END IF;
END $$;

-- ============================================
-- Step 5: Add indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ocean_freight_rate_origin_code 
  ON ocean_freight_rate(origin_code);
  
CREATE INDEX IF NOT EXISTS idx_ocean_freight_rate_destination_code 
  ON ocean_freight_rate(destination_code);
  
CREATE INDEX IF NOT EXISTS idx_ocean_freight_rate_origin_dest 
  ON ocean_freight_rate(origin_code, destination_code);

-- ============================================
-- Step 6: Update materialized view (if exists)
-- ============================================

-- Note: This will need to be adjusted based on your actual mv_freight_sell_prices definition
-- The view should include both pol_code/pod_code (for V1/V2/V3) and origin_code/destination_code (for V4)

-- Example (adjust based on your actual view):
-- IMPORTANT: Include both old and new columns for backward compatibility
/*
DROP MATERIALIZED VIEW IF EXISTS mv_freight_sell_prices CASCADE;

CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  ofr.id as rate_id,
  -- Old columns (for V1/V2/V3 backward compatibility)
  pol.unlocode as pol_code,
  pod.unlocode as pod_code,
  pol.name as pol_name,
  pod.name as pod_name,
  -- New columns (for V4 APIs)
  ofr.origin_code,
  ofr.destination_code,
  pol.name as origin_name,        -- NEW: Name for origin port
  pod.name as destination_name,   -- NEW: Name for destination port
  -- Rest of your view columns...
  ofr.container_type,
  ofr.buy_amount as ocean_freight_buy,
  -- ... calculate margins, surcharges, etc.
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id
-- ... other joins
WHERE ofr.is_active = true;

-- Refresh the view
REFRESH MATERIALIZED VIEW mv_freight_sell_prices;

-- Create indexes on materialized view
CREATE INDEX idx_mv_freight_sell_prices_origin ON mv_freight_sell_prices(origin_code);
CREATE INDEX idx_mv_freight_sell_prices_destination ON mv_freight_sell_prices(destination_code);
CREATE INDEX idx_mv_freight_sell_prices_origin_dest ON mv_freight_sell_prices(origin_code, destination_code);
*/

COMMIT;

-- ============================================
-- Verification Query (run after migration)
-- ============================================

-- Run this to verify migration:
/*
SELECT 
  COUNT(*) as total_rates,
  COUNT(origin_code) as has_origin,
  COUNT(destination_code) as has_destination,
  COUNT(*) FILTER (WHERE origin_code IS NULL) as missing_origin,
  COUNT(*) FILTER (WHERE destination_code IS NULL) as missing_destination,
  COUNT(*) FILTER (WHERE origin_code = (SELECT unlocode FROM locations WHERE id = pol_id)) as origin_matches_pol,
  COUNT(*) FILTER (WHERE destination_code = (SELECT unlocode FROM locations WHERE id = pod_id)) as dest_matches_pod
FROM ocean_freight_rate;
*/

