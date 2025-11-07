# V4 Field Mapping Strategy

## Overview
V4 APIs use new field names (`origin`/`destination`) in the **API interface**, but the **database schema remains unchanged** (still uses `pol_code`/`pod_code`). This allows:
- ✅ V1, V2, V3 APIs continue working (they use `pol_code`/`pod_code`)
- ✅ V4 APIs use new field names (`origin`/`destination`)
- ✅ No database schema changes required
- ✅ Backward compatibility maintained

---

## Mapping Strategy

### Request → Database (Input Mapping)
**V4 API Request:**
```json
{
  "origin": "INNSA",
  "destination": "NLRTM"
}
```

**Internal Database Query:**
```typescript
// V4 routes map origin → pol_code, destination → pod_code
supabase
  .from('mv_freight_sell_prices')
  .eq('pol_code', origin.toUpperCase())  // Maps origin → pol_code
  .eq('pod_code', destination.toUpperCase())  // Maps destination → pod_code
```

### Database → Response (Output Mapping)
**Database Returns:**
```json
{
  "pol_code": "INNSA",
  "pod_code": "NLRTM",
  "pol_name": "Nhava Sheva",
  "pod_name": "Rotterdam"
}
```

**V4 API Response:**
```json
{
  "origin": "INNSA",      // Maps pol_code → origin
  "destination": "NLRTM", // Maps pod_code → destination
  "route": "Nhava Sheva → Rotterdam"
}
```

---

## Implementation Details

### V4 Search Rates
**File**: `src/routes/v4-routes.ts`

**Input Mapping:**
```typescript
// Line 29-30: Accept origin/destination
const { origin, destination, ... } = request.body;

// Line 64-65: Map to pol_code/pod_code for database query
.eq('pol_code', origin.toUpperCase())
.eq('pod_code', destination.toUpperCase())
```

**Output Mapping:**
```typescript
// Line 98-99: Return origin/destination in response
origin: origin.toUpperCase(),
destination: destination.toUpperCase(),
```

### V4 Prepare Quote
**File**: `src/routes/v4-routes.ts`

**Input Mapping:**
```typescript
// Line 219-220: Accept origin/destination
const { origin, destination, ... } = request.body;

// Line 254-255: Map to pol_code/pod_code for database query
.eq('pol_code', origin.toUpperCase())
.eq('pod_code', destination.toUpperCase())
```

**Output Mapping:**
```typescript
// Line 274-275, 503-504, 601-602: Return origin/destination in response
origin: origin.toUpperCase(),
destination: destination.toUpperCase(),
```

### Inland Haulage RPC
**File**: `src/routes/v4-routes.ts`

**Mapping for RPC Call:**
```typescript
// Line 128-129, 443-444: Map origin/destination to p_pol_code/p_pod_code
await supabase.rpc('simplified_inland_function', {
  p_pol_code: origin.toUpperCase(),  // Maps origin → p_pol_code
  p_pod_code: destination.toUpperCase()  // Maps destination → p_pod_code
});
```

**Note**: The RPC function still expects `p_pol_code`/`p_pod_code` (database naming), so we map the V4 field names to the RPC parameter names.

---

## Database Schema (Unchanged)

### Tables/Views Still Use Old Names
- `mv_freight_sell_prices` - has `pol_code`, `pod_code` columns
- `locations` - has `unlocode` column (used for both)
- `ocean_freight_rate` - has `pol_id`, `pod_id` columns
- `v_local_charges_details` - has `origin_port_code`, `destination_port_code`
- `simplified_inland_function` RPC - expects `p_pol_code`, `p_pod_code` parameters

### V4 Mapping Layer
V4 APIs act as a **translation layer**:
1. **Accept** `origin`/`destination` from clients
2. **Map** to `pol_code`/`pod_code` for database queries
3. **Return** `origin`/`destination` to clients

---

## Benefits of This Approach

1. **No Database Migration**: Existing tables/views unchanged
2. **Backward Compatibility**: V1, V2, V3 continue working
3. **Clean API**: V4 uses intuitive field names
4. **Single Source of Truth**: Database remains the source
5. **Easy Rollback**: Can disable V4 without affecting database

---

## Testing Checklist

- [x] V4 accepts `origin`/`destination` in request
- [x] V4 maps to `pol_code`/`pod_code` for database queries
- [x] V4 returns `origin`/`destination` in response
- [ ] V1/V2/V3 still work with `pol_code`/`pod_code`
- [ ] Database queries use correct field names
- [ ] RPC calls use correct parameter names

---

## Future Considerations

If we ever want to migrate the database:
1. Create migration to rename columns (or add new columns)
2. Update all APIs to use new names
3. Deprecate old field names
4. Remove old columns after deprecation period

**For now**: Mapping layer is the correct approach - no database changes needed!

