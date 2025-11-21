# Transshipment Handling in Schedule APIs

## Problem
When cargo needs to go from Port A → Port C, but there's no direct service, it must:
1. Sail from Port A → Port B (transshipment hub) on Service 1
2. Transfer cargo at Port B (connection time required)
3. Sail from Port B → Port C on Service 2

## Example
- **POL**: INMUN (Mundra, India)
- **Transshipment**: AENJM (Jebel Ali, UAE)
- **POD**: DEHAM (Hamburg, Germany)

**Leg 1**: INMUN → AENJM on ME1 service (Vessel: MAERSK COLOMBO, Voyage: 123E)
**Leg 2**: AENJM → DEHAM on AE1 service (Vessel: MAERSK HAMBURG, Voyage: 456W)

## Data Model

### Current Structure
- `voyage` - Represents a single vessel journey
- `transport_call` - Port calls within a voyage
- `port_call_time` - Arrival/departure times at each port

### Transshipment Detection Logic

1. **Direct Route Check**: First, check if POL and POD are on the same voyage
2. **Transshipment Search**: If no direct route:
   - Find voyages where POL appears before POD in sequence
   - Find voyages where a transshipment port appears between POL and POD
   - Find connecting voyages from transshipment port to POD
3. **Connection Validation**: Ensure:
   - Arrival at transshipment port (Leg 1) < Departure from transshipment port (Leg 2)
   - Minimum connection time (e.g., 24-48 hours for container transfer)
   - Same carrier (optional - can allow inter-carrier transshipment)

## API Response Structure

### Direct Route
```json
{
  "route_type": "direct",
  "legs": [
    {
      "leg_number": 1,
      "carrier": "MAERSK",
      "service_code": "ME1",
      "service_name": "MEWA",
      "voyage_number": "123E",
      "vessel_name": "MAERSK COLOMBO",
      "pol": { "unlocode": "INMUN", "name": "Mundra", "departure": "2025-11-15T10:00:00Z" },
      "pod": { "unlocode": "DEHAM", "name": "Hamburg", "arrival": "2025-11-30T14:00:00Z" }
    }
  ],
  "total_transit_days": 15
}
```

### Transshipment Route
```json
{
  "route_type": "transshipment",
  "transshipment_port": {
    "unlocode": "AENJM",
    "name": "Jebel Ali"
  },
  "legs": [
    {
      "leg_number": 1,
      "carrier": "MAERSK",
      "service_code": "ME1",
      "service_name": "MEWA",
      "voyage_number": "123E",
      "vessel_name": "MAERSK COLOMBO",
      "pol": { "unlocode": "INMUN", "name": "Mundra", "departure": "2025-11-15T10:00:00Z" },
      "pod": { "unlocode": "AENJM", "name": "Jebel Ali", "arrival": "2025-11-22T14:00:00Z" }
    },
    {
      "leg_number": 2,
      "carrier": "MAERSK",
      "service_code": "AE1",
      "service_name": "AE1 Service",
      "voyage_number": "456W",
      "vessel_name": "MAERSK HAMBURG",
      "pol": { "unlocode": "AENJM", "name": "Jebel Ali", "departure": "2025-11-24T10:00:00Z" },
      "pod": { "unlocode": "DEHAM", "name": "Hamburg", "arrival": "2025-11-30T14:00:00Z" }
    }
  ],
  "connection_time_hours": 44,
  "total_transit_days": 15
}
```

## Connection Time Requirements

- **Minimum Connection Time**: 24 hours (configurable)
- **Recommended Connection Time**: 48-72 hours for reliability
- **Same Carrier**: Preferred (easier cargo transfer)
- **Different Carrier**: Possible but may require additional handling

## Algorithm

### Step 1: Find Direct Routes
```sql
-- Check if POL and POD are on same voyage
SELECT voyage_id, sequence_no
FROM transport_call
WHERE location_id IN (pol_location_id, pod_location_id)
GROUP BY voyage_id
HAVING COUNT(DISTINCT location_id) = 2
AND MIN(sequence_no WHERE location_id = pol_location_id) < 
    MIN(sequence_no WHERE location_id = pod_location_id)
```

### Step 2: Find Transshipment Routes
```sql
-- Find voyages that call at POL
-- Then find voyages that call at POD after calling at common transshipment ports
-- Match based on:
-- 1. Transshipment port appears in both voyages
-- 2. Arrival at transshipment (Leg 1) < Departure from transshipment (Leg 2)
-- 3. Connection time >= minimum
```

### Step 3: Rank Routes
- **Priority 1**: Direct routes (fastest, no transfer)
- **Priority 2**: Same carrier transshipment (easier transfer)
- **Priority 3**: Different carrier transshipment (more complex)
- **Priority 4**: Multiple transshipments (least preferred)

## Implementation Considerations

1. **Performance**: Transshipment search can be expensive - cache common routes
2. **Accuracy**: Connection times are estimates - actual may vary
3. **Flexibility**: Allow filtering by:
   - Same carrier only
   - Maximum number of transshipments
   - Preferred transshipment ports
   - Maximum connection time

## API Parameters

```
GET /api/customer/schedules/routes?pol_code=INMUN&pod_code=DEHAM&include_transshipment=true&max_transshipments=1&min_connection_hours=24&same_carrier_only=false
```

- `include_transshipment`: Include transshipment routes (default: true)
- `max_transshipments`: Maximum number of transshipment ports (default: 1)
- `min_connection_hours`: Minimum connection time required (default: 24)
- `same_carrier_only`: Only show same-carrier connections (default: false)







