-- Comprehensive check: Verify all port call time fields are being entered correctly
-- This checks PLANNED, ESTIMATED, ACTUAL times for both ARRIVAL and DEPARTURE

-- 1. Overall statistics: Count by time_kind and event_type
SELECT 
    time_kind,
    event_type,
    COUNT(*) as record_count,
    COUNT(DISTINCT transport_call_id) as unique_transport_calls
FROM public.port_call_time
GROUP BY time_kind, event_type
ORDER BY time_kind, event_type;

-- 2. Transport call coverage: How complete is the time data?
SELECT 
    COUNT(DISTINCT tc.id) as total_transport_calls,
    COUNT(DISTINCT CASE WHEN pct.id IS NOT NULL THEN tc.id END) as transport_calls_with_any_time,
    COUNT(DISTINCT CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.port_call_time pct2 
            WHERE pct2.transport_call_id = tc.id 
            AND pct2.time_kind = 'PLANNED' AND pct2.event_type = 'ARRIVAL'
        ) AND EXISTS (
            SELECT 1 FROM public.port_call_time pct3 
            WHERE pct3.transport_call_id = tc.id 
            AND pct3.time_kind = 'PLANNED' AND pct3.event_type = 'DEPARTURE'
        ) THEN tc.id
    END) as transport_calls_with_both_planned,
    COUNT(DISTINCT CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.port_call_time pct2 
            WHERE pct2.transport_call_id = tc.id 
            AND pct2.time_kind = 'ESTIMATED' AND pct2.event_type = 'ARRIVAL'
        ) AND EXISTS (
            SELECT 1 FROM public.port_call_time pct3 
            WHERE pct3.transport_call_id = tc.id 
            AND pct3.time_kind = 'ESTIMATED' AND pct3.event_type = 'DEPARTURE'
        ) THEN tc.id
    END) as transport_calls_with_both_estimated,
    COUNT(DISTINCT CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.port_call_time pct2 
            WHERE pct2.transport_call_id = tc.id 
            AND pct2.time_kind = 'ACTUAL' AND pct2.event_type = 'ARRIVAL'
        ) AND EXISTS (
            SELECT 1 FROM public.port_call_time pct3 
            WHERE pct3.transport_call_id = tc.id 
            AND pct3.time_kind = 'ACTUAL' AND pct3.event_type = 'DEPARTURE'
        ) THEN tc.id
    END) as transport_calls_with_both_actual
FROM public.transport_call tc
LEFT JOIN public.port_call_time pct ON pct.transport_call_id = tc.id
WHERE tc.created_at >= NOW() - INTERVAL '7 days';

-- 3. Sample data: Show a few complete transport calls with all time types
SELECT 
    tc.id as transport_call_id,
    tc.sequence_no,
    l.unlocode,
    l.location_name,
    v.carrier_voyage_number,
    s.carrier_service_code,
    s.carrier_service_name,
    -- Planned times
    MAX(CASE WHEN pct.time_kind = 'PLANNED' AND pct.event_type = 'ARRIVAL' THEN pct.event_datetime END) as planned_arrival,
    MAX(CASE WHEN pct.time_kind = 'PLANNED' AND pct.event_type = 'DEPARTURE' THEN pct.event_datetime END) as planned_departure,
    -- Estimated times
    MAX(CASE WHEN pct.time_kind = 'ESTIMATED' AND pct.event_type = 'ARRIVAL' THEN pct.event_datetime END) as estimated_arrival,
    MAX(CASE WHEN pct.time_kind = 'ESTIMATED' AND pct.event_type = 'DEPARTURE' THEN pct.event_datetime END) as estimated_departure,
    -- Actual times
    MAX(CASE WHEN pct.time_kind = 'ACTUAL' AND pct.event_type = 'ARRIVAL' THEN pct.event_datetime END) as actual_arrival,
    MAX(CASE WHEN pct.time_kind = 'ACTUAL' AND pct.event_type = 'DEPARTURE' THEN pct.event_datetime END) as actual_departure,
    -- Count of time records
    COUNT(pct.id) as time_record_count
FROM public.transport_call tc
JOIN public.locations l ON l.id = tc.location_id
JOIN public.voyage v ON v.id = tc.voyage_id
JOIN public.service s ON s.id = v.service_id
LEFT JOIN public.port_call_time pct ON pct.transport_call_id = tc.id
WHERE tc.created_at >= NOW() - INTERVAL '7 days'
GROUP BY tc.id, tc.sequence_no, l.unlocode, l.location_name, v.carrier_voyage_number, s.carrier_service_code, s.carrier_service_name
HAVING COUNT(pct.id) > 0
ORDER BY v.carrier_voyage_number, tc.sequence_no
LIMIT 20;

-- 4. Time field completeness: How many transport calls have each type of time?
SELECT 
    COUNT(DISTINCT tc.id) as total_transport_calls,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM public.port_call_time pct 
        WHERE pct.transport_call_id = tc.id 
        AND pct.time_kind = 'PLANNED' AND pct.event_type = 'ARRIVAL'
    ) THEN tc.id END) as has_planned_arrival,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM public.port_call_time pct 
        WHERE pct.transport_call_id = tc.id 
        AND pct.time_kind = 'PLANNED' AND pct.event_type = 'DEPARTURE'
    ) THEN tc.id END) as has_planned_departure,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM public.port_call_time pct 
        WHERE pct.transport_call_id = tc.id 
        AND pct.time_kind = 'ESTIMATED' AND pct.event_type = 'ARRIVAL'
    ) THEN tc.id END) as has_estimated_arrival,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM public.port_call_time pct 
        WHERE pct.transport_call_id = tc.id 
        AND pct.time_kind = 'ESTIMATED' AND pct.event_type = 'DEPARTURE'
    ) THEN tc.id END) as has_estimated_departure,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM public.port_call_time pct 
        WHERE pct.transport_call_id = tc.id 
        AND pct.time_kind = 'ACTUAL' AND pct.event_type = 'ARRIVAL'
    ) THEN tc.id END) as has_actual_arrival,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM public.port_call_time pct 
        WHERE pct.transport_call_id = tc.id 
        AND pct.time_kind = 'ACTUAL' AND pct.event_type = 'DEPARTURE'
    ) THEN tc.id END) as has_actual_departure
FROM public.transport_call tc
WHERE tc.created_at >= NOW() - INTERVAL '7 days';

-- 5. Recent activity: Latest port call times by carrier
SELECT 
    c.name as carrier_name,
    s.carrier_service_code,
    COUNT(DISTINCT tc.id) as transport_calls,
    COUNT(pct.id) as time_records,
    MAX(pct.created_at) as latest_time_insert
FROM public.port_call_time pct
JOIN public.transport_call tc ON tc.id = pct.transport_call_id
JOIN public.voyage v ON v.id = tc.voyage_id
JOIN public.service s ON s.id = v.service_id
JOIN public.carrier c ON c.id = s.carrier_id
WHERE pct.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY c.name, s.carrier_service_code
ORDER BY latest_time_insert DESC;




