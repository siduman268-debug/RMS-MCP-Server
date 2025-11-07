# Transit Time Calculation Issue - Westbound/Eastbound Mapping

## Problem

The `v_port_to_port_routes` view is calculating transit time incorrectly (showing 1.4 days instead of ~20 days for INNSA → NLRTM).

## Root Cause

The issue is with **westbound to eastbound mapping** in the database view. The view might be:
1. Using dates from the wrong leg of the voyage (e.g., transshipment port instead of final destination)
2. Mixing up westbound (W) and eastbound (E) voyage directions
3. Calculating transit time between intermediate ports instead of origin → destination

## Current Workaround

The code now:
1. ✅ Calculates transit time from `origin_departure` to `destination_arrival` if both fields exist
2. ✅ Logs detailed information about available fields and calculated values
3. ✅ Falls back to Maersk API if database transit time seems incorrect

## What to Check

### 1. View Definition
Check the `v_port_to_port_routes` view definition in Supabase:
```sql
SELECT pg_get_viewdef('v_port_to_port_routes', true);
```

Look for:
- How `transit_time_days` is calculated
- Whether it uses `origin_departure` and `destination_arrival` correctly
- If it handles westbound/eastbound voyages correctly

### 2. Actual Data
Query the view directly:
```sql
SELECT 
  origin_unlocode,
  destination_unlocode,
  origin_departure,
  destination_arrival,
  transit_time_days,
  carrier_voyage_number,
  carrier_name
FROM v_port_to_port_routes
WHERE origin_unlocode = 'INNSA'
  AND destination_unlocode = 'NLRTM'
  AND carrier_name = 'MAERSK'
  AND origin_departure >= CURRENT_DATE
ORDER BY origin_departure ASC
LIMIT 5;
```

Check:
- Does `destination_arrival` exist and have correct values?
- Is `transit_time_days` calculated correctly?
- Are the dates for the correct voyage direction (W vs E)?

### 3. Server Logs
The enhanced logging will show:
- All available fields from the view
- Calculated transit time from dates
- Warnings if there's a mismatch

## Expected Fix

The view should:
1. **Use correct dates**: `origin_departure` from origin port, `destination_arrival` at final destination
2. **Handle voyage directions**: Correctly map westbound (W) and eastbound (E) voyages
3. **Calculate full route**: Not just a segment, but the complete origin → destination transit time

## Temporary Solution

Until the view is fixed:
- The code will try to calculate transit time from dates if available
- If calculation fails or seems wrong, it will use the view's value (which may be incorrect)
- Maersk API fallback will be used if database doesn't have the route

## Next Steps

1. ✅ Code updated with calculation and logging
2. ⏳ Check server logs to see what fields are available
3. ⏳ Review `v_port_to_port_routes` view definition
4. ⏳ Fix the view to correctly calculate transit time for westbound/eastbound routes

