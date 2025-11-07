# V4 API Implementation - Action Points Summary

## Overview
Create new V4 versions of search-rates and prepare-quote APIs with:
1. New field names: `origin`/`destination` (instead of `pol_code`/`pod_code`)
2. Automatic inland haulage detection and inclusion
3. Earliest departure from Maersk schedules

---

## Action Points

### 1. Create Schedule Integration Service
**File**: `src/services/schedule-integration.service.ts`
- Helper function `getEarliestDeparture(origin, carrier)`
- Primary: Query `v_port_to_port_routes` view filtered by origin AND carrier
- Fallback: Use `MaerskDCSAAdapter.fetchPointToPoint()` if carrier is Maersk
- Return `{ found: boolean, ...departure_data }` or `{ found: false }` on error

### 2. Create V4 Routes File
**File**: `src/routes/v4-routes.ts`
- Export function `addV4Routes(fastify, supabase)`
- Will contain both V4 endpoints

### 3. Implement V4 Search Rates Endpoint
**Endpoint**: `POST /api/v4/search-rates`
- Accept `origin`, `destination`, `container_type`, `vendor_name`
- Accept `cargo_weight_mt`, `haulage_type` (required if inland detected)
- Accept `include_earliest_departure` (optional)
- Query `mv_freight_sell_prices` using origin/destination
- **Automatic inland detection**: Check `locations.location_type = 'ICD'`
- If inland: Call `simplified_inland_function` RPC for each rate
- If `include_earliest_departure = true`: Get earliest departure for each carrier
- Return rates with `inland_haulage` and `earliest_departure` objects

### 4. Implement V4 Prepare Quote Endpoint
**Endpoint**: `POST /api/v4/prepare-quote`
- Accept `origin`, `destination`, `container_type`, `container_count`
- Accept `salesforce_org_id` (required)
- Accept `cargo_weight_mt`, `haulage_type` (required if inland detected)
- Accept `include_earliest_departure` (optional, default: true)
- Use same logic as V1 but with new field names
- **Automatic inland detection**: Check `locations.location_type = 'ICD'`
- If inland: Call `simplified_inland_function` RPC
- Add `inland_haulage_total_usd` to totals
- Update `grand_total_usd` to include haulage
- Get earliest departure for preferred rate's carrier
- Return complete quote with all components

### 5. Register V4 Routes in Main Server
**File**: `src/index.ts`
- Import `addV4Routes` from `./routes/v4-routes.js`
- Call `addV4Routes(fastify, supabase)` in `createHttpServer()`

### 6. Update API Documentation
**File**: `API_DOCUMENTATION.md`
- Add V4 endpoints section
- Document request/response structures
- Document automatic inland detection behavior

---

## Testing Plan

### Test 1: Schedule Integration Service
- Test `getEarliestDeparture()` with database view
- Test fallback to Maersk API
- Test error handling (return `found: false`)

### Test 2: V4 Search Rates - Basic
- Test with seaport to seaport (no inland)
- Verify rates returned correctly
- Verify field names are `origin`/`destination`

### Test 3: V4 Search Rates - Inland Detection
- Test with inland origin (e.g., INTKD)
- Verify automatic inland detection
- Verify IHE charges included
- Test with missing `cargo_weight_mt` (should error)

### Test 4: V4 Search Rates - Earliest Departure
- Test with `include_earliest_departure = true`
- Verify earliest departure for each carrier
- Test with no schedule data (should return `found: false`)

### Test 5: V4 Prepare Quote - Basic
- Test with seaport to seaport
- Verify quote structure matches V1
- Verify field names are `origin`/`destination`

### Test 6: V4 Prepare Quote - Inland Integration
- Test with inland origin
- Verify automatic IHE calculation
- Verify `inland_haulage_total_usd` in totals
- Verify `grand_total_usd` includes haulage

### Test 7: V4 Prepare Quote - Earliest Departure
- Test with preferred rate's carrier
- Verify earliest departure included
- Verify carrier matches rate's carrier

---

## Implementation Order

1. ✅ **Schedule Integration Service** (Foundation)
2. ✅ **V4 Routes File Structure** (Setup)
3. ✅ **V4 Search Rates - Basic** (Core functionality)
4. ✅ **V4 Search Rates - Inland Detection** (Automatic detection)
5. ✅ **V4 Search Rates - Earliest Departure** (Schedule integration)
6. ✅ **V4 Prepare Quote - Basic** (Core functionality)
7. ✅ **V4 Prepare Quote - Inland Integration** (Automatic detection)
8. ✅ **V4 Prepare Quote - Earliest Departure** (Schedule integration)
9. ✅ **Register Routes** (Connect to server)
10. ✅ **Update Documentation** (Final step)

---

## Key Implementation Details

### Inland Port Detection
```typescript
// Check if port is inland
const { data: location } = await supabase
  .from('locations')
  .select('location_type')
  .eq('unlocode', origin)
  .single();

const isInland = location?.location_type === 'ICD';
```

### Inland Haulage Call
```typescript
const { data: result } = await supabase.rpc('simplified_inland_function', {
  p_pol_code: origin,
  p_pod_code: destination,
  p_container_type: container_type,
  p_container_count: container_count || 1,
  p_cargo_weight_mt: cargo_weight_mt,
  p_haulage_type: haulage_type
});
```

### Earliest Departure Query
```typescript
// Primary: Database view
const { data } = await supabase
  .from('v_port_to_port_routes')
  .select('*')
  .eq('origin_unlocode', origin)
  .ilike('carrier_name', carrier)
  .gte('origin_departure', new Date().toISOString())
  .order('origin_departure', { ascending: true })
  .limit(1);
```

---

**Status**: Ready to start implementation
**Next Step**: Create Schedule Integration Service

