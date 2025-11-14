-- Examples of how to use the schedule views
-- These queries demonstrate the power of the views we created

-- ============================================
-- 1. WEEKLY VESSEL SCHEDULE VIEW
-- ============================================

-- Get all vessels sailing in a specific week
SELECT 
    sailing_week,
    carrier_name,
    carrier_service_code,
    vessel_name,
    carrier_voyage_number,
    unlocode,
    location_name,
    planned_arrival,
    planned_departure
FROM v_weekly_vessel_schedule
WHERE sailing_week = '2025-11-03'  -- Week of Nov 3, 2025
ORDER BY carrier_service_code, carrier_voyage_number, port_sequence;

-- Get all ME1 service sailings for the next 4 weeks
SELECT 
    sailing_week,
    carrier_voyage_number,
    vessel_name,
    unlocode,
    location_name,
    planned_arrival,
    planned_departure
FROM v_weekly_vessel_schedule
WHERE carrier_service_code = '471'  -- ME1 service
  AND sailing_week >= DATE_TRUNC('week', CURRENT_DATE)
  AND sailing_week <= DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '4 weeks'
ORDER BY sailing_week, carrier_voyage_number, port_sequence;

-- Get all vessels calling at INNSA (Nhava Sheva) in the next month
SELECT 
    sailing_week,
    carrier_name,
    carrier_service_code,
    carrier_service_name,
    vessel_name,
    carrier_voyage_number,
    planned_arrival,
    planned_departure,
    estimated_arrival,
    estimated_departure
FROM v_weekly_vessel_schedule
WHERE unlocode = 'INNSA'
  AND sailing_week >= DATE_TRUNC('week', CURRENT_DATE)
  AND sailing_week <= DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '4 weeks'
ORDER BY planned_arrival;

-- ============================================
-- 2. VOYAGE ROUTES WITH TRANSIT TIMES VIEW
-- ============================================

-- Get all route segments for ME1 service with transit times
SELECT 
    carrier_voyage_number,
    vessel_name,
    route_segment,
    origin_port,
    destination_port,
    origin_departure,
    destination_arrival,
    ROUND(transit_time_days, 1) as transit_days
FROM v_voyage_routes_with_transit
WHERE carrier_service_code = '471'  -- ME1
  AND origin_departure >= CURRENT_DATE
ORDER BY carrier_voyage_number, origin_sequence;

-- Find fastest route from INNSA to NLRTM
SELECT 
    carrier_name,
    carrier_service_code,
    carrier_voyage_number,
    vessel_name,
    route_segment,
    origin_departure,
    destination_arrival,
    ROUND(transit_time_days, 1) as transit_days
FROM v_voyage_routes_with_transit
WHERE origin_unlocode = 'INNSA'
  AND destination_unlocode = 'NLRTM'
  AND origin_departure >= CURRENT_DATE
ORDER BY transit_time_days ASC
LIMIT 10;

-- ============================================
-- 3. SERVICE WEEKLY SUMMARY VIEW
-- ============================================

-- Get weekly summary for all Maersk services
SELECT 
    sailing_week,
    carrier_service_code,
    carrier_service_name,
    voyage_count,
    vessel_count,
    port_call_count,
    unique_ports,
    ports_served,
    first_departure,
    last_departure
FROM v_service_weekly_summary
WHERE carrier_name = 'MAERSK'
  AND sailing_week >= DATE_TRUNC('week', CURRENT_DATE)
ORDER BY sailing_week DESC, carrier_service_code;

-- Find services with most frequent sailings
SELECT 
    carrier_service_code,
    carrier_service_name,
    COUNT(DISTINCT sailing_week) as weeks_active,
    SUM(voyage_count) as total_voyages,
    AVG(voyage_count) as avg_voyages_per_week
FROM v_service_weekly_summary
WHERE sailing_week >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '12 weeks'
GROUP BY carrier_service_code, carrier_service_name
ORDER BY avg_voyages_per_week DESC;

-- ============================================
-- 4. PORT-TO-PORT ROUTES VIEW
-- ============================================

-- Find all direct routes from Indian ports to European ports
SELECT DISTINCT
    carrier_name,
    carrier_service_code,
    route,
    origin_port,
    destination_port,
    ROUND(AVG(transit_time_days), 1) as avg_transit_days,
    MIN(origin_departure) as next_departure,
    COUNT(*) as voyage_count
FROM v_port_to_port_routes
WHERE origin_country = 'India'
  AND destination_country IN ('Netherlands', 'Germany', 'United Kingdom')
  AND origin_departure >= CURRENT_DATE
GROUP BY carrier_name, carrier_service_code, route, origin_port, destination_port
ORDER BY avg_transit_days, next_departure;

-- Get next 5 sailings from INMUN to USNYC
SELECT 
    carrier_service_code,
    carrier_voyage_number,
    vessel_name,
    origin_departure,
    destination_arrival,
    ROUND(transit_time_days, 1) as transit_days
FROM v_port_to_port_routes
WHERE origin_unlocode = 'INMUN'
  AND destination_unlocode = 'USNYC'
  AND origin_departure >= CURRENT_DATE
ORDER BY origin_departure
LIMIT 5;

-- ============================================
-- COMBINED QUERIES
-- ============================================

-- Get complete voyage details for a specific voyage
SELECT 
    vws.sailing_week,
    vws.carrier_name,
    vws.carrier_service_code,
    vws.carrier_voyage_number,
    vws.vessel_name,
    vws.port_sequence,
    vws.unlocode,
    vws.location_name,
    vws.planned_arrival,
    vws.planned_departure,
    vws.estimated_arrival,
    vws.estimated_departure
FROM v_weekly_vessel_schedule vws
WHERE vws.carrier_voyage_number = '544W'
  AND vws.carrier_service_code = '471'
ORDER BY vws.port_sequence;

-- Find services serving both INMUN and INNSA
SELECT DISTINCT
    carrier_service_code,
    carrier_service_name,
    COUNT(DISTINCT sailing_week) as weeks_served
FROM v_weekly_vessel_schedule
WHERE unlocode IN ('INMUN', 'INNSA')
  AND sailing_week >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY carrier_service_code, carrier_service_name
HAVING COUNT(DISTINCT CASE WHEN unlocode = 'INMUN' THEN 1 END) > 0
   AND COUNT(DISTINCT CASE WHEN unlocode = 'INNSA' THEN 1 END) > 0
ORDER BY weeks_served DESC;





