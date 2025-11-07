-- ============================================
-- GET VIEW DEFINITIONS FOR MIGRATION
-- Purpose: Get definitions of views that need origin_code/destination_code columns
-- Date: 2025-01-17
-- ============================================

-- Priority 1: Views used by APIs
-- ============================================

-- 1. v_local_charges_details (HIGH PRIORITY - used by prepare-quote)
SELECT 
  'v_local_charges_details' as view_name,
  'HIGH PRIORITY - Used by prepare-quote endpoints' as priority,
  pg_get_viewdef('v_local_charges_details', true) as definition;

-- 2. v_freight_surcharge_details (HIGH PRIORITY - user requested)
SELECT 
  'v_freight_surcharge_details' as view_name,
  'HIGH PRIORITY - User requested' as priority,
  pg_get_viewdef('v_freight_surcharge_details', true) as definition;

-- 3. v_port_to_port_routes (MEDIUM PRIORITY - used for schedules)
SELECT 
  'v_port_to_port_routes' as view_name,
  'MEDIUM PRIORITY - Used for schedules' as priority,
  pg_get_viewdef('v_port_to_port_routes', true) as definition;

-- 4. v_preferred_ofr (MEDIUM PRIORITY - may be used)
SELECT 
  'v_preferred_ofr' as view_name,
  'MEDIUM PRIORITY - May be used' as priority,
  pg_get_viewdef('v_preferred_ofr', true) as definition;

-- 5. v_surcharges (LOW PRIORITY - check if needed)
SELECT 
  'v_surcharges' as view_name,
  'LOW PRIORITY - Check if needed' as priority,
  pg_get_viewdef('v_surcharges', true) as definition;

-- 6. v_rms_ocean_ofr (LOW PRIORITY - check if needed)
SELECT 
  'v_rms_ocean_ofr' as view_name,
  'LOW PRIORITY - Check if needed' as priority,
  pg_get_viewdef('v_rms_ocean_ofr', true) as definition;

-- ============================================
-- Check which views reference pol/pod columns
-- ============================================

-- Find views that reference pol_code, pod_code, pol_id, pod_id
SELECT DISTINCT
  v.viewname,
  CASE 
    WHEN def ILIKE '%pol_code%' OR def ILIKE '%pod_code%' THEN 'Has pol_code/pod_code'
    WHEN def ILIKE '%pol_id%' OR def ILIKE '%pod_id%' THEN 'Has pol_id/pod_id'
    WHEN def ILIKE '%pol_name%' OR def ILIKE '%pod_name%' THEN 'Has pol_name/pod_name'
    ELSE 'No pol/pod references'
  END as pol_pod_reference
FROM pg_views v
CROSS JOIN LATERAL (
  SELECT pg_get_viewdef(v.viewname::regclass, true) as def
) d
WHERE v.schemaname = 'public'
  AND (
    v.viewname IN (
      'v_local_charges_details',
      'v_freight_surcharge_details',
      'v_port_to_port_routes',
      'v_preferred_ofr',
      'v_surcharges',
      'v_rms_ocean_ofr',
      'v_active_surcharges',
      'v_service_weekly_summary',
      'v_voyage_routes_with_transit',
      'v_weekly_vessel_schedule'
    )
  )
ORDER BY v.viewname;

