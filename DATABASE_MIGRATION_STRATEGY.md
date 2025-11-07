# Database Migration Strategy: Adding Origin/Destination Columns

## Goal
- Add `origin_code` and `destination_code` columns to database
- Copy existing `pol_code`/`pod_code` data to new columns
- Eventually use `pol`/`pod` for routing perspective (different semantic meaning)
- Maintain backward compatibility during migration

---

## Migration Strategy

### Phase 1: Add New Columns (Non-Breaking)
Add new columns alongside existing ones, make them nullable initially.

**Tables to Update:**
1. `mv_freight_sell_prices` (materialized view - may need to recreate)
2. `ocean_freight_rate` (base table)
3. `v_local_charges_details` (view - may need to recreate)
4. Any other tables/views that reference pol_code/pod_code

**SQL Migration:**
```sql
-- Add new columns to base tables
ALTER TABLE ocean_freight_rate 
  ADD COLUMN origin_code VARCHAR(10),
  ADD COLUMN destination_code VARCHAR(10);

-- Copy existing data
UPDATE ocean_freight_rate 
SET 
  origin_code = (SELECT unlocode FROM locations WHERE id = pol_id),
  destination_code = (SELECT unlocode FROM locations WHERE id = pod_id);

-- Make columns NOT NULL after data is populated
ALTER TABLE ocean_freight_rate 
  ALTER COLUMN origin_code SET NOT NULL,
  ALTER COLUMN destination_code SET NOT NULL;

-- Add indexes
CREATE INDEX idx_ocean_freight_rate_origin ON ocean_freight_rate(origin_code);
CREATE INDEX idx_ocean_freight_rate_destination ON ocean_freight_rate(destination_code);
```

### Phase 2: Update Views
Update materialized views and regular views to include new columns.

**Example for mv_freight_sell_prices:**
```sql
-- Drop and recreate materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_freight_sell_prices;

CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  ofr.id as rate_id,
  -- Old columns (for V1/V2/V3 backward compatibility)
  pol.unlocode as pol_code,
  pod.unlocode as pod_code,
  pol.name as pol_name,
  pod.name as pod_name,
  -- New columns (for V4 APIs)
  ofr.origin_code,                  -- NEW: From ocean_freight_rate table
  ofr.destination_code,             -- NEW: From ocean_freight_rate table
  pol.name as origin_name,          -- NEW: Port name for origin
  pod.name as destination_name,     -- NEW: Port name for destination
  -- ... rest of columns
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id;
```

**Note**: 
- `origin_code`/`destination_code` come from `ocean_freight_rate` table (after migration)
- `origin_name`/`destination_name` are aliases of `pol.name`/`pod.name` (same data initially)
- Both old and new columns exist for backward compatibility

### Phase 3: Dual Support Period
During this period, both column sets exist and contain the same data.

**V4 APIs:**
- Use `origin_code`/`destination_code` columns
- Query: `.eq('origin_code', origin)`

**V1/V2/V3 APIs:**
- Continue using `pol_code`/`pod_code` columns
- Query: `.eq('pol_code', pol_code)`

**Both work simultaneously!**

### Phase 4: Future Routing Perspective
Once `pol`/`pod` are repurposed for routing:
- `origin_code`/`destination_code` = Actual port locations (where cargo is)
- `pol_code`/`pod_code` = Routing ports (where vessel calls)

**Example:**
```
origin_code: "INTKD" (Inland Container Depot - where cargo originates)
pol_code: "INNSA" (Port of Loading - where vessel loads, routing perspective)
```

---

## Migration Script

### Step 1: Add Columns
```sql
-- ocean_freight_rate table
ALTER TABLE ocean_freight_rate 
  ADD COLUMN IF NOT EXISTS origin_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS destination_code VARCHAR(10);

-- Add comments
COMMENT ON COLUMN ocean_freight_rate.origin_code IS 'Origin port UN/LOCODE (where cargo originates)';
COMMENT ON COLUMN ocean_freight_rate.destination_code IS 'Destination port UN/LOCODE (where cargo is delivered)';
COMMENT ON COLUMN ocean_freight_rate.pol_code IS 'Port of Loading - routing perspective (may differ from origin)';
COMMENT ON COLUMN ocean_freight_rate.pod_code IS 'Port of Discharge - routing perspective (may differ from destination)';
```

### Step 2: Copy Data
```sql
-- Copy from locations table via pol_id/pod_id
UPDATE ocean_freight_rate ofr
SET 
  origin_code = (SELECT unlocode FROM locations WHERE id = ofr.pol_id),
  destination_code = (SELECT unlocode FROM locations WHERE id = ofr.pod_id)
WHERE origin_code IS NULL OR destination_code IS NULL;

-- Verify data copied correctly
SELECT 
  COUNT(*) as total,
  COUNT(origin_code) as has_origin,
  COUNT(destination_code) as has_destination,
  COUNT(*) FILTER (WHERE origin_code IS NULL) as missing_origin,
  COUNT(*) FILTER (WHERE destination_code IS NULL) as missing_destination
FROM ocean_freight_rate;
```

### Step 3: Update Views
```sql
-- Recreate mv_freight_sell_prices with both column sets
DROP MATERIALIZED VIEW IF EXISTS mv_freight_sell_prices CASCADE;

CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  ofr.id as rate_id,
  -- Old columns (for V1/V2/V3)
  pol.unlocode as pol_code,
  pod.unlocode as pod_code,
  pol.name as pol_name,
  pod.name as pod_name,
  -- New columns (for V4)
  pol.unlocode as origin_code,      -- Initially same as pol_code
  pod.unlocode as destination_code,  -- Initially same as pod_code
  -- Rest of columns...
  ofr.container_type,
  ofr.buy_amount as ocean_freight_buy,
  -- ... calculate margins, surcharges, etc.
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id
-- ... joins for contracts, vendors, etc.
WHERE ofr.is_active = true;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW mv_freight_sell_prices;

-- Create indexes
CREATE INDEX idx_mv_freight_sell_prices_origin ON mv_freight_sell_prices(origin_code);
CREATE INDEX idx_mv_freight_sell_prices_destination ON mv_freight_sell_prices(destination_code);
```

### Step 4: Update V4 Routes
Once columns exist, update V4 routes to use new columns:

```typescript
// OLD (current):
.eq('pol_code', origin.toUpperCase())

// NEW (after migration):
.eq('origin_code', origin.toUpperCase())
```

---

## Will It Get Messy?

### ✅ **NO, if done correctly:**

**Advantages:**
1. **Gradual Migration**: Both column sets work during transition
2. **No Breaking Changes**: V1/V2/V3 continue using old columns
3. **Clear Separation**: New columns for V4, old columns for routing
4. **Easy Rollback**: Can remove new columns if needed
5. **Future Flexibility**: `pol`/`pod` can be repurposed for routing

**Potential Issues (and solutions):**
1. **Data Duplication**: Initially same data in both columns
   - ✅ **Solution**: This is fine - allows gradual migration
   - ✅ **Future**: Can diverge when routing perspective is implemented

2. **View Complexity**: Views need both column sets
   - ✅ **Solution**: Use aliases - `pol.unlocode as pol_code, pol.unlocode as origin_code`
   - ✅ **Future**: Can remove old columns after migration period

3. **Index Overhead**: Two sets of indexes
   - ✅ **Solution**: Acceptable trade-off for migration period
   - ✅ **Future**: Can drop old indexes after migration

---

## Recommended Approach

### Option A: Add Columns Now (Recommended)
1. ✅ Add `origin_code`/`destination_code` columns
2. ✅ Copy data from `pol_code`/`pod_code` (via location lookup)
3. ✅ Update views to include both column sets
4. ✅ Update V4 routes to use new columns
5. ✅ Keep V1/V2/V3 on old columns
6. ✅ **Future**: Use `pol`/`pod` for routing when ready

**Timeline:**
- Week 1: Add columns, copy data
- Week 2: Update views, test V4 with new columns
- Week 3: Deploy V4 with new columns
- Month 2+: Gradually migrate V1/V2/V3 if needed
- Month 6+: Repurpose `pol`/`pod` for routing

### Option B: Keep Mapping Layer (Current)
- ✅ No database changes needed
- ✅ V4 uses mapping layer (current implementation)
- ❌ Can't repurpose `pol`/`pod` for routing later
- ❌ Always need mapping logic

---

## Migration Checklist

- [ ] Add `origin_code`/`destination_code` columns to `ocean_freight_rate`
- [ ] Copy data from `pol_id`/`pod_id` via locations lookup
- [ ] Update `mv_freight_sell_prices` view to include both column sets
- [ ] Update `v_local_charges_details` view if needed
- [ ] Create indexes on new columns
- [ ] Update V4 routes to use `origin_code`/`destination_code`
- [ ] Test V4 APIs with new columns
- [ ] Test V1/V2/V3 APIs still work with old columns
- [ ] Deploy migration
- [ ] Monitor for issues
- [ ] **Future**: Repurpose `pol`/`pod` for routing perspective

---

## SQL Migration Script Template

```sql
-- ============================================
-- MIGRATION: Add Origin/Destination Columns
-- ============================================

BEGIN;

-- Step 1: Add columns
ALTER TABLE ocean_freight_rate 
  ADD COLUMN IF NOT EXISTS origin_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS destination_code VARCHAR(10);

-- Step 2: Copy data
UPDATE ocean_freight_rate ofr
SET 
  origin_code = COALESCE(
    (SELECT unlocode FROM locations WHERE id = ofr.pol_id),
    ofr.origin_code
  ),
  destination_code = COALESCE(
    (SELECT unlocode FROM locations WHERE id = ofr.pod_id),
    ofr.destination_code
  )
WHERE origin_code IS NULL OR destination_code IS NULL;

-- Step 3: Add constraints (after data is populated)
ALTER TABLE ocean_freight_rate 
  ALTER COLUMN origin_code SET NOT NULL,
  ALTER COLUMN destination_code SET NOT NULL;

-- Step 4: Add indexes
CREATE INDEX IF NOT EXISTS idx_ocean_freight_rate_origin 
  ON ocean_freight_rate(origin_code);
CREATE INDEX IF NOT EXISTS idx_ocean_freight_rate_destination 
  ON ocean_freight_rate(destination_code);

-- Step 5: Update views (example - adjust based on actual view definition)
-- Note: This will need to be done for each view that uses pol_code/pod_code

COMMIT;

-- Step 6: Verify
SELECT 
  COUNT(*) as total_rates,
  COUNT(origin_code) as has_origin,
  COUNT(destination_code) as has_destination,
  COUNT(*) FILTER (WHERE origin_code IS NULL) as missing_origin,
  COUNT(*) FILTER (WHERE destination_code IS NULL) as missing_destination
FROM ocean_freight_rate;
```

---

## Recommendation

**YES, add the columns!** It's the cleanest long-term solution:

1. ✅ **Clean Separation**: `origin`/`destination` for cargo, `pol`/`pod` for routing
2. ✅ **No Mess**: Initial copy is fine - data will be identical
3. ✅ **Future-Proof**: Allows routing perspective implementation
4. ✅ **Gradual Migration**: Both work during transition
5. ✅ **Easy Rollback**: Can remove if needed

**Next Steps:**
1. Create migration script
2. Test on development database
3. Deploy to production
4. Update V4 routes to use new columns
5. Monitor and verify

Would you like me to create the actual migration SQL script for your specific schema?

