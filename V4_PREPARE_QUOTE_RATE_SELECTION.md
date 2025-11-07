# V4 Prepare Quote - Rate Selection

## Current Implementation

**V4 prepare-quote** currently uses **automatic preferred rate selection** (same as V1):

```typescript
// Line 263-272 in src/routes/v4-routes.ts
let rateQuery = buildOriginDestinationQuery(
  supabase.from('mv_freight_sell_prices').select('*'),
  origin,
  destination
)
  .eq('container_type', container_type)
  .eq('is_preferred', true)  // ← Automatically picks preferred rate
  .limit(1);
```

## Comparison with Other Versions

| Version | Rate Selection Method |
|---------|----------------------|
| **V1** | `is_preferred = true` (automatic) |
| **V2** | `rate_id` (user specifies) |
| **V3** | `is_preferred = true` (automatic) |
| **V4** | `is_preferred = true` (automatic) ← Current |

## V2 Implementation (Uses rate_id)

```typescript
// V2 prepare-quote (line 1994-2016)
const { salesforce_org_id, rate_id, container_count = 1 } = request.body;

// Get rate by rate_id
const { data: rateData, error: rateError } = await supabase
  .from('mv_freight_sell_prices')
  .select('*')
  .eq('rate_id', rate_id)
  .single();
```

## Options for V4

### Option 1: Keep Current (Preferred Rate Only)
- ✅ Simple
- ✅ Consistent with V1/V3
- ❌ Can't specify a specific rate

### Option 2: Add rate_id Support (Like V2)
- ✅ More flexible
- ✅ Can specify exact rate from search results
- ❌ More complex logic

### Option 3: Support Both (Preferred OR rate_id)
- ✅ Most flexible
- ✅ Backward compatible
- ✅ Best user experience
- ❌ Most complex

## Recommended: Option 3 (Support Both)

Allow V4 to accept **either**:
1. `origin` + `destination` + `container_type` → picks preferred rate
2. `rate_id` → uses specific rate (from search-rates results)

This gives users flexibility:
- Quick quotes: Use preferred rate automatically
- Specific quotes: Use rate_id from search-rates results

---

## Implementation Plan (If Adding rate_id Support)

1. Make `rate_id` optional in request
2. If `rate_id` provided: Query by rate_id
3. If `rate_id` not provided: Query by origin/destination + preferred
4. Rest of logic remains the same

Would you like me to implement rate_id support for V4 prepare-quote?

