-- ============================================
-- MIGRATION: Update mv_freight_sell_prices Materialized View
-- Purpose: Add origin_code, destination_code, origin_name, destination_name columns
-- Date: 2025-01-17
-- ============================================

-- IMPORTANT: Replace this template with your ACTUAL view definition
-- This is just a template showing where to add the new columns

-- Step 1: Drop existing view
DROP MATERIALIZED VIEW IF EXISTS mv_freight_sell_prices CASCADE;

-- Step 2: Recreate with new columns
-- ⚠️ CRITICAL: Copy your EXISTING view definition COMPLETELY, then ADD the 4 new columns
-- DO NOT remove any existing columns - V1/V2/V3 APIs depend on them!

-- First, get your current view definition:
-- SELECT pg_get_viewdef('mv_freight_sell_prices', true);

-- Then, add these 4 new columns after pod_name:
--   ofr.origin_code,
--   ofr.destination_code,
--   pol.name as origin_name,
--   pol.name as destination_name,

CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  -- ⚠️ COPY ALL YOUR EXISTING COLUMNS FROM YOUR CURRENT VIEW
  -- This is just a template - you MUST replace with your actual view definition
  
  -- IDENTIFIERS (example - use your actual columns)
  ofr.id as rate_id,
  
  -- OLD COLUMNS (V1/V2/V3) - MUST KEEP THESE
  pol.unlocode as pol_code,
  pod.unlocode as pod_code,
  pol.name as pol_name,
  pod.name as pod_name,
  
  -- NEW COLUMNS (V4) - ADD THESE 4 COLUMNS
  ofr.origin_code,
  ofr.destination_code,
  pol.name as origin_name,
  pod.name as destination_name,
  
  -- ⚠️ CRITICAL: Relationship columns (V1/V2/V3 prepare-quote NEED these!)
  ofr.contract_id,    -- MUST KEEP - used for local charges lookup
  ofr.pol_id,        -- MUST KEEP - used for origin charges
  ofr.pod_id,        -- MUST KEEP - used for destination charges
  ofr.vendor_id,     -- MUST KEEP - used for charge filtering
  
  -- Continue with ALL your other existing columns
  -- Example columns (replace with your actual columns):
  ofr.container_type,
  v.name as carrier,  -- or however you get carrier
  ofr.buy_amount as ocean_freight_buy,
  -- ... calculate freight_surcharges
  -- ... calculate all_in_freight_buy
  -- ... calculate margin_type, margin_percentage, margin_amount
  -- ... calculate all_in_freight_sell
  ofr.currency,
  ofr.valid_from,
  ofr.valid_to,
  ofr.is_preferred,
  ofr.tt_days as transit_days,
  -- ... ALL OTHER COLUMNS FROM YOUR ORIGINAL VIEW
  
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id
-- ... ALL OTHER JOINs from your original view (contracts, vendors, etc.)
WHERE ofr.is_active = true;

-- Step 3: Refresh the view
REFRESH MATERIALIZED VIEW mv_freight_sell_prices;

-- Step 4: Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_origin_code 
  ON mv_freight_sell_prices(origin_code);
  
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_destination_code 
  ON mv_freight_sell_prices(destination_code);
  
CREATE INDEX IF NOT EXISTS idx_mv_freight_sell_prices_origin_dest 
  ON mv_freight_sell_prices(origin_code, destination_code);

-- ============================================
-- HOW TO USE THIS TEMPLATE:
-- ============================================
-- 1. First, get your current view definition:
--    SELECT pg_get_viewdef('mv_freight_sell_prices', true);
--
-- 2. Copy the SELECT statement from that output
--
-- 3. Add the new columns (origin_code, destination_code, origin_name, destination_name)
--    in the SELECT list, making sure to:
--    - Add commas between all columns
--    - Keep all existing columns
--    - Add the new columns after pol_name/pod_name
--
-- 4. Replace the template above with your actual view definition
--
-- ============================================

