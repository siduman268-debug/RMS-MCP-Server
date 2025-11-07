-- ============================================
-- CHECK ALL VIEWS FOR MIGRATION
-- Purpose: Identify all views that need origin_code/destination_code columns
-- Date: 2025-01-17
-- ============================================

-- Step 1: List all views in the database
SELECT 
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY viewname;

-- Step 2: List all materialized views
SELECT 
  schemaname,
  matviewname,
  matviewowner
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY matviewname;

-- Step 3: Get definitions of views that likely need updating
-- (Views that reference pol/pod or locations)

-- Check mv_freight_sell_prices (already done)
SELECT 'mv_freight_sell_prices' as view_name, pg_get_viewdef('mv_freight_sell_prices', true) as definition;

-- Check v_local_charges_details
SELECT 'v_local_charges_details' as view_name, pg_get_viewdef('v_local_charges_details', true) as definition;

-- Check v_freight_surcharge_details (if exists)
SELECT 'v_freight_surcharge_details' as view_name, pg_get_viewdef('v_freight_surcharge_details', true) as definition;

-- Check v_port_to_port_routes (if exists - used for schedules)
SELECT 'v_port_to_port_routes' as view_name, pg_get_viewdef('v_port_to_port_routes', true) as definition;

-- Check any other views with 'freight', 'surcharge', 'port', 'local', 'charge' in name
SELECT 
  viewname,
  pg_get_viewdef(viewname::regclass, true) as definition
FROM pg_views
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND (
    viewname ILIKE '%freight%' OR
    viewname ILIKE '%surcharge%' OR
    viewname ILIKE '%port%' OR
    viewname ILIKE '%local%' OR
    viewname ILIKE '%charge%' OR
    viewname ILIKE '%route%'
  )
ORDER BY viewname;

-- Check materialized views with similar patterns
SELECT 
  matviewname,
  pg_get_viewdef(matviewname::regclass, true) as definition
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND (
    matviewname ILIKE '%freight%' OR
    matviewname ILIKE '%surcharge%' OR
    matviewname ILIKE '%port%' OR
    matviewname ILIKE '%local%' OR
    matviewname ILIKE '%charge%' OR
    matviewname ILIKE '%route%'
  )
ORDER BY matviewname;

-- ============================================
-- ANALYSIS QUERIES
-- ============================================

-- Find views that reference pol_code, pod_code, pol_id, or pod_id
SELECT DISTINCT
  v.viewname,
  'References pol/pod columns' as reason
FROM pg_views v
CROSS JOIN LATERAL (
  SELECT pg_get_viewdef(v.viewname::regclass, true) as def
) d
WHERE v.schemaname NOT IN ('pg_catalog', 'information_schema')
  AND (
    d.def ILIKE '%pol_code%' OR
    d.def ILIKE '%pod_code%' OR
    d.def ILIKE '%pol_id%' OR
    d.def ILIKE '%pod_id%' OR
    d.def ILIKE '%pol_name%' OR
    d.def ILIKE '%pod_name%'
  )
ORDER BY v.viewname;

-- Find materialized views with similar references
SELECT DISTINCT
  mv.matviewname,
  'References pol/pod columns' as reason
FROM pg_matviews mv
CROSS JOIN LATERAL (
  SELECT pg_get_viewdef(mv.matviewname::regclass, true) as def
) d
WHERE mv.schemaname NOT IN ('pg_catalog', 'information_schema')
  AND (
    d.def ILIKE '%pol_code%' OR
    d.def ILIKE '%pod_code%' OR
    d.def ILIKE '%pol_id%' OR
    d.def ILIKE '%pod_id%' OR
    d.def ILIKE '%pol_name%' OR
    d.def ILIKE '%pod_name%'
  )
ORDER BY mv.matviewname;

