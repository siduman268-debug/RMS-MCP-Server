-- Verify that port call times were successfully inserted
-- Run this after the n8n workflow completes

-- 1. Count total port call times
SELECT 
    COUNT(*) as total_port_call_times,
    COUNT(DISTINCT transport_call_id) as transport_calls_with_times,
    MAX(created_at) as latest_insert
FROM public.port_call_time;

-- 2. Count by time kind
SELECT 
    time_kind,
    event_type,
    COUNT(*) as count
FROM public.port_call_time
GROUP BY time_kind, event_type
ORDER BY time_kind, event_type;

-- 3. Recent port call times (last 20)
SELECT 
    pct.id,
    pct.transport_call_id,
    pct.event_type,
    pct.time_kind,
    pct.event_datetime,
    pct.created_at,
    tc.sequence_no,
    l.unlocode,
    l.location_name
FROM public.port_call_time pct
JOIN public.transport_call tc ON tc.id = pct.transport_call_id
JOIN public.locations l ON l.id = tc.location_id
ORDER BY pct.created_at DESC
LIMIT 20;

-- 4. Transport calls with time counts
SELECT 
    COUNT(DISTINCT tc.id) as total_transport_calls,
    COUNT(DISTINCT CASE WHEN pct.id IS NOT NULL THEN tc.id END) as transport_calls_with_times,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN pct.id IS NOT NULL THEN tc.id END) / COUNT(DISTINCT tc.id), 2) as percentage_with_times
FROM public.transport_call tc
LEFT JOIN public.port_call_time pct ON pct.transport_call_id = tc.id
WHERE tc.created_at >= NOW() - INTERVAL '24 hours';
