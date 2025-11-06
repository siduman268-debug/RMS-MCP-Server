-- Create useful views for schedule data
-- These views make it easier to query vessel schedules, port calls, and transit times

-- 1. View: Weekly Vessel Sailing Schedule
-- Shows all vessels with their voyages, services, and port calls organized by week
CREATE OR REPLACE VIEW v_weekly_vessel_schedule AS
SELECT 
    -- Week information
    DATE_TRUNC('week', COALESCE(
        (SELECT event_datetime FROM public.port_call_time pct 
         WHERE pct.transport_call_id = tc.id 
         AND pct.event_type = 'DEPARTURE' 
         AND pct.time_kind = 'PLANNED'
         ORDER BY pct.event_datetime ASC LIMIT 1),
        tc.created_at
    ))::DATE as sailing_week,
    TO_CHAR(DATE_TRUNC('week', COALESCE(
        (SELECT event_datetime FROM public.port_call_time pct 
         WHERE pct.transport_call_id = tc.id 
         AND pct.event_type = 'DEPARTURE' 
         AND pct.time_kind = 'PLANNED'
         ORDER BY pct.event_datetime ASC LIMIT 1),
        tc.created_at
    )), 'YYYY-MM-DD') as week_start,
    
    -- Service information
    c.name as carrier_name,
    s.carrier_service_code,
    s.carrier_service_name,
    
    -- Vessel information
    v.carrier_voyage_number,
    ves.name as vessel_name,
    ves.imo as vessel_imo,
    
    -- Port call information
    tc.sequence_no as port_sequence,
    l.unlocode,
    l.location_name,
    l.country,
    
    -- Timestamps (prefer PLANNED, fallback to ESTIMATED)
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = tc.id 
     AND pct.event_type = 'ARRIVAL' 
     AND pct.time_kind = 'PLANNED'
     LIMIT 1) as planned_arrival,
    
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = tc.id 
     AND pct.event_type = 'DEPARTURE' 
     AND pct.time_kind = 'PLANNED'
     LIMIT 1) as planned_departure,
    
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = tc.id 
     AND pct.event_type = 'ARRIVAL' 
     AND pct.time_kind = 'ESTIMATED'
     LIMIT 1) as estimated_arrival,
    
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = tc.id 
     AND pct.event_type = 'DEPARTURE' 
     AND pct.time_kind = 'ESTIMATED'
     LIMIT 1) as estimated_departure,
    
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = tc.id 
     AND pct.event_type = 'ARRIVAL' 
     AND pct.time_kind = 'ACTUAL'
     LIMIT 1) as actual_arrival,
    
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = tc.id 
     AND pct.event_type = 'DEPARTURE' 
     AND pct.time_kind = 'ACTUAL'
     LIMIT 1) as actual_departure,
    
    -- Route information
    tc.carrier_export_voyage_number,
    tc.carrier_import_voyage_number,
    tc.transport_call_reference,
    
    -- Metadata
    tc.id as transport_call_id,
    v.id as voyage_id,
    s.id as service_id,
    ves.id as vessel_id,
    tc.created_at,
    tc.updated_at
    
FROM public.transport_call tc
JOIN public.voyage v ON v.id = tc.voyage_id
JOIN public.service s ON s.id = v.service_id
JOIN public.carrier c ON c.id = s.carrier_id
JOIN public.vessel ves ON ves.id = v.vessel_id
JOIN public.locations l ON l.id = tc.location_id
ORDER BY sailing_week DESC, carrier_name, s.carrier_service_code, v.carrier_voyage_number, tc.sequence_no;

-- 2. View: Complete Voyage Route with Transit Times
-- Shows full voyage routes with calculated transit times between ports
CREATE OR REPLACE VIEW v_voyage_routes_with_transit AS
WITH port_times AS (
    SELECT 
        tc.id as transport_call_id,
        tc.voyage_id,
        tc.sequence_no,
        l.unlocode,
        l.location_name,
        -- Get departure time (prefer PLANNED, fallback to ESTIMATED)
        COALESCE(
            (SELECT event_datetime FROM public.port_call_time pct 
             WHERE pct.transport_call_id = tc.id 
             AND pct.event_type = 'DEPARTURE' 
             AND pct.time_kind = 'PLANNED'
             LIMIT 1),
            (SELECT event_datetime FROM public.port_call_time pct 
             WHERE pct.transport_call_id = tc.id 
             AND pct.event_type = 'DEPARTURE' 
             AND pct.time_kind = 'ESTIMATED'
             LIMIT 1)
        ) as departure_time,
        -- Get arrival time (prefer PLANNED, fallback to ESTIMATED)
        COALESCE(
            (SELECT event_datetime FROM public.port_call_time pct 
             WHERE pct.transport_call_id = tc.id 
             AND pct.event_type = 'ARRIVAL' 
             AND pct.time_kind = 'PLANNED'
             LIMIT 1),
            (SELECT event_datetime FROM public.port_call_time pct 
             WHERE pct.transport_call_id = tc.id 
             AND pct.event_type = 'ARRIVAL' 
             AND pct.time_kind = 'ESTIMATED'
             LIMIT 1)
        ) as arrival_time
    FROM public.transport_call tc
    JOIN public.locations l ON l.id = tc.location_id
)
SELECT 
    v.id as voyage_id,
    c.name as carrier_name,
    s.carrier_service_code,
    s.carrier_service_name,
    v.carrier_voyage_number,
    ves.name as vessel_name,
    ves.imo as vessel_imo,
    
    -- Origin port
    pt1.unlocode as origin_unlocode,
    pt1.location_name as origin_port,
    pt1.arrival_time as origin_arrival,
    pt1.departure_time as origin_departure,
    
    -- Destination port
    pt2.unlocode as destination_unlocode,
    pt2.location_name as destination_port,
    pt2.arrival_time as destination_arrival,
    pt2.departure_time as destination_departure,
    
    -- Transit time calculation
    CASE 
        WHEN pt1.departure_time IS NOT NULL AND pt2.arrival_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (pt2.arrival_time - pt1.departure_time)) / 86400.0
        ELSE NULL
    END as transit_time_days,
    
    -- Route segment
    pt1.sequence_no as origin_sequence,
    pt2.sequence_no as destination_sequence,
    CONCAT(pt1.unlocode, ' → ', pt2.unlocode) as route_segment
    
FROM public.voyage v
JOIN public.service s ON s.id = v.service_id
JOIN public.carrier c ON c.id = s.carrier_id
JOIN public.vessel ves ON ves.id = v.vessel_id
JOIN port_times pt1 ON pt1.voyage_id = v.id
JOIN port_times pt2 ON pt2.voyage_id = v.id AND pt2.sequence_no = pt1.sequence_no + 1
ORDER BY v.carrier_voyage_number, pt1.sequence_no;

-- 3. View: Service Schedule Summary by Week
-- Aggregated view showing service frequency and vessel counts by week
CREATE OR REPLACE VIEW v_service_weekly_summary AS
SELECT 
    DATE_TRUNC('week', COALESCE(
        (SELECT event_datetime FROM public.port_call_time pct 
         JOIN public.transport_call tc ON tc.id = pct.transport_call_id
         WHERE tc.voyage_id = v.id 
         AND pct.event_type = 'DEPARTURE' 
         AND pct.time_kind = 'PLANNED'
         ORDER BY pct.event_datetime ASC LIMIT 1),
        v.created_at
    ))::DATE as sailing_week,
    
    c.name as carrier_name,
    s.carrier_service_code,
    s.carrier_service_name,
    
    COUNT(DISTINCT v.id) as voyage_count,
    COUNT(DISTINCT ves.id) as vessel_count,
    COUNT(DISTINCT tc.id) as port_call_count,
    COUNT(DISTINCT l.unlocode) as unique_ports,
    
    -- Port list
    STRING_AGG(DISTINCT l.unlocode, ', ' ORDER BY l.unlocode) as ports_served,
    
    -- First and last departure times
    MIN((SELECT event_datetime FROM public.port_call_time pct 
         WHERE pct.transport_call_id = tc.id 
         AND pct.event_type = 'DEPARTURE' 
         AND pct.time_kind = 'PLANNED'
         LIMIT 1)) as first_departure,
    
    MAX((SELECT event_datetime FROM public.port_call_time pct 
         WHERE pct.transport_call_id = tc.id 
         AND pct.event_type = 'DEPARTURE' 
         AND pct.time_kind = 'PLANNED'
         LIMIT 1)) as last_departure
    
FROM public.voyage v
JOIN public.service s ON s.id = v.service_id
JOIN public.carrier c ON c.id = s.carrier_id
JOIN public.vessel ves ON ves.id = v.vessel_id
JOIN public.transport_call tc ON tc.voyage_id = v.id
JOIN public.locations l ON l.id = tc.location_id
GROUP BY 
    sailing_week,
    c.name,
    s.carrier_service_code,
    s.carrier_service_name
ORDER BY sailing_week DESC, carrier_name, s.carrier_service_code;

-- 4. View: Port-to-Port Direct Routes
-- Shows all direct routes between ports with transit times
CREATE OR REPLACE VIEW v_port_to_port_routes AS
SELECT 
    c.name as carrier_name,
    s.carrier_service_code,
    s.carrier_service_name,
    v.carrier_voyage_number,
    
    -- Origin
    origin.unlocode as origin_unlocode,
    origin.location_name as origin_port,
    origin.country as origin_country,
    origin_tc.sequence_no as origin_sequence,
    
    -- Destination
    dest.unlocode as destination_unlocode,
    dest.location_name as destination_port,
    dest.country as destination_country,
    dest_tc.sequence_no as destination_sequence,
    
    -- Times
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = origin_tc.id 
     AND pct.event_type = 'DEPARTURE' 
     AND pct.time_kind = 'PLANNED'
     LIMIT 1) as origin_departure,
    
    (SELECT event_datetime FROM public.port_call_time pct 
     WHERE pct.transport_call_id = dest_tc.id 
     AND pct.event_type = 'ARRIVAL' 
     AND pct.time_kind = 'PLANNED'
     LIMIT 1) as destination_arrival,
    
    -- Transit time
    CASE 
        WHEN (SELECT event_datetime FROM public.port_call_time pct 
              WHERE pct.transport_call_id = origin_tc.id 
              AND pct.event_type = 'DEPARTURE' 
              AND pct.time_kind = 'PLANNED'
              LIMIT 1) IS NOT NULL 
        AND (SELECT event_datetime FROM public.port_call_time pct 
             WHERE pct.transport_call_id = dest_tc.id 
             AND pct.event_type = 'ARRIVAL' 
             AND pct.time_kind = 'PLANNED'
             LIMIT 1) IS NOT NULL
        THEN EXTRACT(EPOCH FROM (
            (SELECT event_datetime FROM public.port_call_time pct 
             WHERE pct.transport_call_id = dest_tc.id 
             AND pct.event_type = 'ARRIVAL' 
             AND pct.time_kind = 'PLANNED'
             LIMIT 1) - 
            (SELECT event_datetime FROM public.port_call_time pct 
             WHERE pct.transport_call_id = origin_tc.id 
             AND pct.event_type = 'DEPARTURE' 
             AND pct.time_kind = 'PLANNED'
             LIMIT 1)
        )) / 86400.0
        ELSE NULL
    END as transit_time_days,
    
    -- Route info
    CONCAT(origin.unlocode, ' → ', dest.unlocode) as route,
    v.id as voyage_id,
    ves.name as vessel_name
    
FROM public.voyage v
JOIN public.service s ON s.id = v.service_id
JOIN public.carrier c ON c.id = s.carrier_id
JOIN public.vessel ves ON ves.id = v.vessel_id
JOIN public.transport_call origin_tc ON origin_tc.voyage_id = v.id
JOIN public.transport_call dest_tc ON dest_tc.voyage_id = v.id 
    AND dest_tc.sequence_no > origin_tc.sequence_no
JOIN public.locations origin ON origin.id = origin_tc.location_id
JOIN public.locations dest ON dest.id = dest_tc.location_id
WHERE dest_tc.sequence_no = origin_tc.sequence_no + 1  -- Direct connections only
ORDER BY carrier_name, s.carrier_service_code, v.carrier_voyage_number, origin_tc.sequence_no;

-- Grant permissions on views
GRANT SELECT ON v_weekly_vessel_schedule TO service_role, authenticated, anon;
GRANT SELECT ON v_voyage_routes_with_transit TO service_role, authenticated, anon;
GRANT SELECT ON v_service_weekly_summary TO service_role, authenticated, anon;
GRANT SELECT ON v_port_to_port_routes TO service_role, authenticated, anon;

