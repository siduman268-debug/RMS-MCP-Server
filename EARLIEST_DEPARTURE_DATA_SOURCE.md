# Earliest Departure Data Source

## Current Implementation

The earliest departure uses a **two-tier fallback system**:

### 1. **PRIMARY: Database View** ✅ (Currently Active)
- **Source**: `v_port_to_port_routes` view in Supabase
- **Query**: Filters by `origin_unlocode`, `destination_unlocode` (if provided), and `carrier_name`
- **Status**: ✅ **ACTIVELY USED** - This is what's currently being used
- **Location**: `src/services/schedule-integration.service.ts` line 57

```typescript
// Primary: Query database view for earliest departure
const departure = await this.getEarliestDepartureFromDatabase(origin, carrier, destination);

if (departure.found) {
  return departure; // ← Returns here if database has data
}
```

### 2. **FALLBACK: Maersk Point-to-Point API** ⚠️ (Not Fully Implemented)
- **Source**: Maersk DCSA API `/ocean/commercial-schedules/dcsa/v1/point-to-point-routes`
- **Method**: `MaerskDCSAAdapter.fetchPointToPoint()`
- **Status**: ⚠️ **EXISTS BUT NOT CALLED** - The fallback function exists but currently just returns "not found"
- **Location**: `src/services/schedule-integration.service.ts` line 68-77

```typescript
// Fallback: Use Maersk API if carrier is Maersk
if (carrier.toUpperCase() === 'MAERSK' && this.dcsaClient) {
  const maerskDeparture = await this.getEarliestDepartureFromMaerskAPI(origin, destination);
  // ↑ This function currently just returns "not found" - needs implementation
}
```

## Current Flow

```
1. Try Database View (v_port_to_port_routes)
   ↓
   ✅ Found? → Return database result (USING THIS NOW)
   ↓
   ❌ Not Found?
   ↓
2. Try Maersk API (if carrier = MAERSK)
   ↓
   ⚠️ Currently returns "not found" (NOT IMPLEMENTED)
```

## What This Means

**Currently, you're using the DATABASE VIEW** (`v_port_to_port_routes`).

The Maersk API fallback exists in the code but:
- The `getEarliestDepartureFromMaerskAPI()` function is not fully implemented
- It just returns `{ found: false, message: 'Maersk API requires destination...' }`
- The `fetchPointToPoint()` method exists in the adapter but isn't being called

## To Use Maersk API as Fallback

If you want to enable the Maersk API fallback, we need to:
1. Implement `getEarliestDepartureFromMaerskAPI()` to actually call `fetchPointToPoint()`
2. Parse the Maersk API response and convert it to `EarliestDeparture` format
3. Handle the case where destination is required (which we now have!)

Would you like me to implement the Maersk API fallback, or keep using the database view only?

