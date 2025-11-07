-- ============================================
-- MIGRATION: Update v_preferred_ofr View
-- Purpose: Add origin_code, destination_code, origin_name, destination_name columns
-- Date: 2025-01-17
-- ============================================

-- Step 1: Drop existing view
DROP VIEW IF EXISTS v_preferred_ofr CASCADE;

-- Step 2: Recreate with new columns added
CREATE VIEW v_preferred_ofr AS
SELECT 
  ofr.tenant_id,
  ofr.id,
  ofr.contract_id,
  rc.vendor_id,
  rc.is_spot,
  ofr.pol_id,
  ofr.pod_id,
  ofr.container_type,
  ofr.buy_amount,
  ofr.currency,
  ofr.tt_days,
  pol.unlocode AS pol,
  pod.unlocode AS pod,
  -- NEW COLUMNS (V4) - ADDED
  pol.unlocode AS origin_code,           -- NEW: For V4
  pod.unlocode AS destination_code,       -- NEW: For V4
  pol.location_name AS origin_name,       -- NEW: For V4
  pod.location_name AS destination_name,  -- NEW: For V4
  v.name AS vendor,
  rc.name AS contract
FROM ocean_freight_rate ofr
  JOIN rate_contract rc ON rc.id = ofr.contract_id
  JOIN vendor v ON v.id = rc.vendor_id
  JOIN locations pol ON pol.id = ofr.pol_id
  JOIN locations pod ON pod.id = ofr.pod_id
WHERE ofr.is_preferred = true;

-- ============================================
-- Verification Query (run after migration)
-- ============================================
-- SELECT 
--   id,
--   pol, pod,  -- Existing
--   origin_code, destination_code,  -- NEW
--   origin_name, destination_name   -- NEW
-- FROM v_preferred_ofr
-- LIMIT 5;

