-- ============================================
-- RUN ALL VIEW MIGRATIONS
-- Purpose: Execute all view migrations in order
-- Date: 2025-01-17
-- ============================================

-- Migration Order:
-- 1. mv_freight_sell_prices (already done - see 003_update_mv_freight_sell_prices_COMPLETE.sql)
-- 2. v_local_charges_details
-- 3. v_freight_surcharge_details
-- 4. v_preferred_ofr

BEGIN;

-- ============================================
-- 1. v_local_charges_details
-- ============================================
\i migrations/007_update_v_local_charges_details_COMPLETE.sql

-- ============================================
-- 2. v_freight_surcharge_details
-- ============================================
\i migrations/008_update_v_freight_surcharge_details_COMPLETE.sql

-- ============================================
-- 3. v_preferred_ofr
-- ============================================
\i migrations/009_update_v_preferred_ofr_COMPLETE.sql

COMMIT;

-- ============================================
-- Verification
-- ============================================
-- Run these to verify all migrations:

-- Check v_local_charges_details
SELECT 
  'v_local_charges_details' as view_name,
  COUNT(*) as row_count,
  COUNT(origin_code) as has_origin_code,
  COUNT(destination_code) as has_destination_code
FROM v_local_charges_details;

-- Check v_freight_surcharge_details
SELECT 
  'v_freight_surcharge_details' as view_name,
  COUNT(*) as row_count,
  COUNT(origin_code) as has_origin_code,
  COUNT(destination_code) as has_destination_code
FROM v_freight_surcharge_details;

-- Check v_preferred_ofr
SELECT 
  'v_preferred_ofr' as view_name,
  COUNT(*) as row_count,
  COUNT(origin_code) as has_origin_code,
  COUNT(destination_code) as has_destination_code
FROM v_preferred_ofr;

