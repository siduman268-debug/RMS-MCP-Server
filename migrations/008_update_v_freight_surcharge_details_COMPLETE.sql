-- ============================================
-- MIGRATION: Update v_freight_surcharge_details View
-- Purpose: Add origin_code, destination_code, origin_name, destination_name columns
-- Date: 2025-01-17
-- ============================================

-- Step 1: Drop existing view
DROP VIEW IF EXISTS v_freight_surcharge_details CASCADE;

-- Step 2: Recreate with new columns added
CREATE VIEW v_freight_surcharge_details AS
SELECT 
  ofr.tenant_id,
  ofr.id AS rate_id,
  ofr.contract_id,
  ofr.pol_id,
  ofr.pod_id,
  ofr.container_type,
  ofr.buy_amount AS ocean_freight_buy,
  v.name AS carrier,
  pol.location_name AS pol_name,
  pol.unlocode AS pol_code,
  pod.location_name AS pod_name,
  pod.unlocode AS pod_code,
  -- NEW COLUMNS (V4) - ADDED
  pol.unlocode AS origin_code,           -- NEW: For V4
  pod.unlocode AS destination_code,       -- NEW: For V4
  pol.location_name AS origin_name,       -- NEW: For V4
  pod.location_name AS destination_name,  -- NEW: For V4
  s.id AS surcharge_id,
  s.charge_code,
  s.vendor_charge_name AS charge_name,
  s.amount AS surcharge_rate,
  s.calc_method,
  s.currency,
  round(
    CASE
      WHEN s.calc_method = ANY (ARRAY['flat'::text, 'per_container'::text]) THEN s.amount
      WHEN s.calc_method = 'percentage'::text THEN ofr.buy_amount * (s.amount / 100::numeric)
      ELSE 0::numeric
    END, 2) AS surcharge_amount
FROM ocean_freight_rate ofr
  LEFT JOIN rate_contract rc ON ofr.contract_id = rc.id
  LEFT JOIN vendor v ON rc.vendor_id = v.id
  LEFT JOIN locations pol ON ofr.pol_id = pol.id
  LEFT JOIN locations pod ON ofr.pod_id = pod.id
  LEFT JOIN surcharge s ON s.contract_id = ofr.contract_id 
    AND s.applies_scope = 'freight'::text 
    AND s.is_active = true 
    AND (s.pol_id IS NULL OR s.pol_id = ofr.pol_id) 
    AND (s.pod_id IS NULL OR s.pod_id = ofr.pod_id) 
    AND (s.container_type IS NULL OR s.container_type = ofr.container_type) 
    AND s.tenant_id = ofr.tenant_id
WHERE s.id IS NOT NULL
ORDER BY ofr.id, s.charge_code;

-- ============================================
-- Verification Query (run after migration)
-- ============================================
-- SELECT 
--   rate_id,
--   pol_code, pod_code, pol_name, pod_name,  -- Existing
--   origin_code, destination_code,            -- NEW
--   origin_name, destination_name             -- NEW
-- FROM v_freight_surcharge_details
-- LIMIT 5;



