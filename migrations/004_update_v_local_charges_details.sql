-- ============================================
-- MIGRATION: Update v_local_charges_details View
-- Purpose: Add origin_code, destination_code, origin_name, destination_name columns
-- Date: 2025-01-17
-- ============================================

-- Step 1: Get your current view definition first
-- Run this to see your current view:
-- SELECT pg_get_viewdef('v_local_charges_details', true);

-- Step 2: Drop existing view
DROP VIEW IF EXISTS v_local_charges_details CASCADE;

-- Step 3: Recreate with new columns
-- ⚠️ CRITICAL: Copy your EXISTING view definition COMPLETELY, then ADD the 4 new columns
-- DO NOT remove any existing columns - V1/V2/V3/V4 APIs depend on them!

-- Template (replace with your actual view definition):
CREATE VIEW v_local_charges_details AS
SELECT 
  -- ⚠️ COPY ALL YOUR EXISTING COLUMNS FROM YOUR CURRENT VIEW
  -- This is just a template - you MUST replace with your actual view definition
  
  -- Example structure (adjust based on your actual view):
  s.id as surcharge_id,
  s.contract_id,
  s.vendor_id,
  s.charge_code,
  s.charge_name as vendor_charge_name,
  s.amount as charge_amount,
  s.currency as charge_currency,
  s.uom,
  s.container_type as surcharge_container_type,
  s.applies_scope,
  s.charge_location_type,
  
  -- Relationship columns (MUST KEEP)
  s.pol_id,
  s.pod_id,
  
  -- Port codes (if they exist - KEEP)
  pol.unlocode as origin_port_code,      -- Keep if exists
  pod.unlocode as destination_port_code, -- Keep if exists
  pol.location_name as origin_port_name, -- Keep if exists
  pod.location_name as destination_port_name, -- Keep if exists
  
  -- NEW COLUMNS (V4) - ADD THESE 4 COLUMNS
  pol.unlocode as origin_code,           -- NEW: For V4
  pod.unlocode as destination_code,      -- NEW: For V4
  pol.location_name as origin_name,      -- NEW: For V4
  pod.location_name as destination_name,  -- NEW: For V4
  
  -- ... ALL OTHER COLUMNS FROM YOUR ORIGINAL VIEW
  
FROM surcharge s
LEFT JOIN locations pol ON s.pol_id = pol.id
LEFT JOIN locations pod ON s.pod_id = pod.id
-- ... ALL OTHER JOINs from your original view
WHERE s.is_active = true;

-- ============================================
-- HOW TO USE THIS TEMPLATE:
-- ============================================
-- 1. Run: SELECT pg_get_viewdef('v_local_charges_details', true);
-- 2. Copy the complete SELECT statement
-- 3. Add these 4 columns after any existing port code/name columns:
--    pol.unlocode as origin_code,
--    pod.unlocode as destination_code,
--    pol.location_name as origin_name,
--    pod.location_name as destination_name,
-- 4. Replace the template above with your actual view definition
-- 5. Make sure to keep ALL existing columns

-- ============================================
-- Verification Query (run after migration)
-- ============================================
-- SELECT 
--   surcharge_id,
--   contract_id,
--   pol_id, pod_id,
--   origin_port_code, destination_port_code,  -- if they exist
--   origin_code, destination_code,            -- NEW
--   origin_name, destination_name             -- NEW
-- FROM v_local_charges_details
-- LIMIT 5;

