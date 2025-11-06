-- ==========================================
-- QUICK VERIFY - RECENT SCHEDULE DATA
-- ==========================================
-- Quick check to see recent schedule data

-- Recent voyages with full details
SELECT 
    v.id as voyage_id,
    c.name as carrier,
    s.carrier_service_code,
    s.carrier_service_name as service_name,
    v.carrier_voyage_number,
    ve.name as vessel_name,
    ve.imo as vessel_imo,
    COUNT(tc.id) as port_calls_count,
    v.created_at
FROM public.voyage v
JOIN public.service s ON v.service_id = s.id
JOIN public.carrier c ON s.carrier_id = c.id
JOIN public.vessel ve ON v.vessel_id = ve.id
LEFT JOIN public.transport_call tc ON tc.voyage_id = v.id
WHERE v.created_at > NOW() - INTERVAL '1 hour'  -- Last hour
GROUP BY v.id, c.name, s.carrier_service_code, s.carrier_service_name, 
         v.carrier_voyage_number, ve.name, ve.imo, v.created_at
ORDER BY v.created_at DESC
LIMIT 20;

