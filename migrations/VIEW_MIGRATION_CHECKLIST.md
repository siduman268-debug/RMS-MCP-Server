# View Migration Checklist

## Overview
This document tracks which views need to be updated with `origin_code`/`destination_code` and `origin_name`/`destination_name` columns.

---

## Views to Check

### ✅ Completed
- [x] `mv_freight_sell_prices` - **DONE** - Migration completed

### 🔄 In Progress
- [ ] `v_local_charges_details` - Template created, needs actual view definition
- [ ] `v_freight_surcharge_details` - Need to check if exists and get definition

### ❓ To Check
- [ ] `v_port_to_port_routes` - Used for schedules, may need updating
- [ ] Any other views with pol/pod references

---

## How to Check Views

Run the queries in `migrations/005_check_all_views.sql` to:
1. List all views
2. Get definitions of relevant views
3. Find views that reference pol/pod columns

---

## Migration Pattern

For each view that needs updating:

1. **Get current definition:**
   ```sql
   SELECT pg_get_viewdef('view_name', true);
   ```

2. **Add 4 new columns:**
   - `origin_code` - from locations.unlocode (where pol_id matches)
   - `destination_code` - from locations.unlocode (where pod_id matches)
   - `origin_name` - from locations.location_name (where pol_id matches)
   - `destination_name` - from locations.location_name (where pod_id matches)

3. **Keep ALL existing columns** - Don't remove anything

4. **Test** - Verify V1/V2/V3 still work

---

## Priority Order

1. **High Priority** (Used by V1/V2/V3/V4 APIs):
   - ✅ `mv_freight_sell_prices` - DONE
   - [ ] `v_local_charges_details` - Used by prepare-quote endpoints

2. **Medium Priority** (May be used):
   - [ ] `v_freight_surcharge_details` - If exists
   - [ ] `v_port_to_port_routes` - Used for schedules

3. **Low Priority** (Check if needed):
   - [ ] Other views with pol/pod references

---

## Notes

- Views that only JOIN locations but don't expose pol/pod columns may not need updating
- Views used only internally (not by APIs) may not need updating
- Focus on views that are queried directly by API endpoints

