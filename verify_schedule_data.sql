-- ==========================================
-- VERIFY SCHEDULE DATA INSERTION
-- ==========================================
-- Run these queries to verify that schedule data was inserted correctly

-- 1. Check carriers inserted
SELECT 
    id,
    name as carrier_name,
    created_at
FROM public.carrier
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check vessels inserted
SELECT 
    id,
    imo,
    name as vessel_name,
    created_at
FROM public.vessel
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check services inserted
SELECT 
    s.id,
    c.name as carrier_name,
    s.carrier_service_code,
    s.carrier_service_name,
    s.created_at
FROM public.service s
JOIN public.carrier c ON s.carrier_id = c.id
ORDER BY s.created_at DESC
LIMIT 10;

-- 4. Check voyages inserted
SELECT 
    v.id,
    c.name as carrier_name,
    s.carrier_service_code,
    v.carrier_voyage_number,
    ve.name as vessel_name,
    v.created_at
FROM public.voyage v
JOIN public.service s ON v.service_id = s.id
JOIN public.carrier c ON s.carrier_id = c.id
JOIN public.vessel ve ON v.vessel_id = ve.id
ORDER BY v.created_at DESC
LIMIT 10;

-- 5. Check transport calls (port calls) inserted
SELECT 
    tc.id,
    c.name as carrier_name,
    v.carrier_voyage_number,
    tc.sequence_no,
    l.unlocode,
    l.location_name,
    tc.carrier_export_voyage_number,
    tc.created_at
FROM public.transport_call tc
JOIN public.voyage v ON tc.voyage_id = v.id
JOIN public.service s ON v.service_id = s.id
JOIN public.carrier c ON s.carrier_id = c.id
JOIN public.locations l ON tc.location_id = l.id
ORDER BY tc.created_at DESC
LIMIT 20;

-- 6. Check port call times inserted
SELECT 
    pct.id,
    c.name as carrier_name,
    v.carrier_voyage_number,
    tc.sequence_no,
    l.unlocode,
    pct.event_type,
    pct.time_kind,
    pct.event_datetime,
    pct.created_at
FROM public.port_call_time pct
JOIN public.transport_call tc ON pct.transport_call_id = tc.id
JOIN public.voyage v ON tc.voyage_id = v.id
JOIN public.service s ON v.service_id = s.id
JOIN public.carrier c ON s.carrier_id = c.id
JOIN public.locations l ON tc.location_id = l.id
ORDER BY pct.created_at DESC
LIMIT 20;

-- 7. Count records by table
SELECT 
    'carrier' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM public.carrier
UNION ALL
SELECT 
    'vessel' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM public.vessel
UNION ALL
SELECT 
    'service' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM public.service
UNION ALL
SELECT 
    'voyage' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM public.voyage
UNION ALL
SELECT 
    'transport_call' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM public.transport_call
UNION ALL
SELECT 
    'port_call_time' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM public.port_call_time
UNION ALL
SELECT 
    'schedule_source_audit' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as latest_record
FROM public.schedule_source_audit
ORDER BY table_name;

-- 8. Check latest schedule source audit (raw payload)
SELECT 
    ssa.id,
    c.name as carrier_name,
    ssa.source_system,
    ssa.created_at,
    jsonb_pretty(ssa.raw_payload) as raw_payload
FROM public.schedule_source_audit ssa
JOIN public.carrier c ON ssa.carrier_id = c.id
ORDER BY ssa.created_at DESC
LIMIT 5;

