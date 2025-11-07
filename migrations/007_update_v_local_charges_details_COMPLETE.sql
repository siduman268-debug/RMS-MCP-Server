-- ============================================
-- MIGRATION: Update v_local_charges_details View
-- Purpose: Add origin_code, destination_code, origin_name, destination_name columns
-- Date: 2025-01-17
-- ============================================

-- Step 1: Drop existing view
DROP VIEW IF EXISTS v_local_charges_details CASCADE;

-- Step 2: Recreate with new columns added
CREATE VIEW v_local_charges_details AS
SELECT 
  ofr.tenant_id,
  ofr.id AS rate_id,
  ofr.contract_id,
  ofr.pol_id,
  ofr.pod_id,
  ofr.container_type,
  ofr.valid_from AS rate_valid_from,
  ofr.valid_to AS rate_valid_to,
  CASE
    WHEN s.applies_scope = 'origin'::text THEN 'Origin Charges'::text
    WHEN s.applies_scope = 'dest'::text THEN 'Destination Charges'::text
    ELSE 'Other'::text
  END AS charge_location_type,
  s.id AS surcharge_id,
  s.charge_code,
  s.vendor_charge_name,
  s.applies_scope,
  s.calc_method,
  s.uom,
  s.currency AS charge_currency,
  s.amount AS charge_amount,
  s.container_type AS surcharge_container_type,
  s.location_id,
  loc.location_name AS charge_location_name,
  loc.unlocode AS charge_location_code,
  pol.location_name AS origin_port_name,
  pol.unlocode AS origin_port_code,
  pod.location_name AS destination_port_name,
  pod.unlocode AS destination_port_code,
  -- NEW COLUMNS (V4) - ADDED
  pol.unlocode AS origin_code,           -- NEW: For V4
  pod.unlocode AS destination_code,       -- NEW: For V4
  pol.location_name AS origin_name,       -- NEW: For V4
  pod.location_name AS destination_name,  -- NEW: For V4
  v.name AS vendor_name,
  s.is_active
FROM ocean_freight_rate ofr
  LEFT JOIN locations pol ON ofr.pol_id = pol.id
  LEFT JOIN locations pod ON ofr.pod_id = pod.id
  LEFT JOIN rate_contract rc ON ofr.contract_id = rc.id
  LEFT JOIN vendor v ON rc.vendor_id = v.id
  LEFT JOIN surcharge s ON (s.applies_scope = 'origin'::text AND s.location_id = pol.id OR s.applies_scope = 'dest'::text AND s.location_id = pod.id) AND s.tenant_id = ofr.tenant_id
  LEFT JOIN locations loc ON s.location_id = loc.id
WHERE (s.container_type = ofr.container_type OR s.container_type IS NULL) 
  AND (s.applies_scope = ANY (ARRAY['origin'::text, 'dest'::text])) 
  AND s.is_active = true
ORDER BY ofr.id, s.applies_scope, s.charge_code;

-- ============================================
-- Verification Query (run after migration)
-- ============================================
-- SELECT 
--   rate_id,
--   pol_id, pod_id,
--   origin_port_code, destination_port_code,  -- Existing
--   origin_code, destination_code,            -- NEW
--   origin_name, destination_name             -- NEW
-- FROM v_local_charges_details
-- LIMIT 5;

