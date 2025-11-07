-- ============================================
-- CORRECTED EXAMPLE: mv_freight_sell_prices Update
-- This shows the CORRECT syntax (no comments in SELECT list)
-- ============================================

-- Step 1: Get your current view definition first
-- Run this to see your current view:
-- SELECT pg_get_viewdef('mv_freight_sell_prices', true);

-- Step 2: Drop existing view
DROP MATERIALIZED VIEW IF EXISTS mv_freight_sell_prices CASCADE;

-- Step 3: Recreate with new columns
-- IMPORTANT: This is an EXAMPLE - you must replace with your ACTUAL view definition
-- The key is: add commas between ALL columns, no comments in the SELECT list

CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  ofr.id as rate_id,
  pol.unlocode as pol_code,
  pod.unlocode as pod_code,
  pol.name as pol_name,
  pod.name as pod_name,
  ofr.origin_code,
  ofr.destination_code,
  pol.name as origin_name,
  pod.name as destination_name,
  ofr.container_type,
  ofr.buy_amount as ocean_freight_buy,
  ofr.currency,
  ofr.tt_days as transit_days,
  ofr.is_preferred,
  ofr.valid_from,
  ofr.valid_to
  -- Add ALL other columns from your original view here
  -- Make sure each column is separated by a comma (except the last one)
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id
-- Add all other JOINs from your original view
WHERE ofr.is_active = true;

-- Step 4: Refresh
REFRESH MATERIALIZED VIEW mv_freight_sell_prices;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_origin_code 
  ON mv_freight_sell_prices(origin_code);
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_destination_code 
  ON mv_freight_sell_prices(destination_code);
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_origin_dest 
  ON mv_freight_sell_prices(origin_code, destination_code);

-- ============================================
-- COMMON ERRORS TO AVOID:
-- ============================================
-- ❌ WRONG: Comments in SELECT list
-- SELECT 
--   ofr.id as rate_id,
--   -- comment here breaks syntax
--   pol.unlocode as pol_code
--
-- ✅ CORRECT: Comments only before SELECT
-- SELECT 
--   ofr.id as rate_id,
--   pol.unlocode as pol_code
--
-- ❌ WRONG: Missing comma
-- SELECT 
--   ofr.id as rate_id
--   pol.unlocode as pol_code
--
-- ✅ CORRECT: Comma between columns
-- SELECT 
--   ofr.id as rate_id,
--   pol.unlocode as pol_code
--
-- ❌ WRONG: Trailing comma before FROM
-- SELECT 
--   ofr.id as rate_id,
-- FROM ocean_freight_rate
--
-- ✅ CORRECT: No comma before FROM
-- SELECT 
--   ofr.id as rate_id
-- FROM ocean_freight_rate

