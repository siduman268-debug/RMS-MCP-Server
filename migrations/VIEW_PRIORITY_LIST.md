# View Migration Priority List

## Based on Code Usage Analysis

### ✅ Completed
- [x] `mv_freight_sell_prices` - **DONE**

### 🔴 High Priority (Used by APIs - Must Update)

1. **`v_local_charges_details`**
   - Used by: V1/V2/V3/V4 prepare-quote endpoints
   - Filters by: `pol_id`, `pod_id`
   - Status: ⏳ Needs migration script
   - Impact: Critical - prepare-quote will break if not updated

2. **`v_freight_surcharge_details`**
   - Used by: User specifically requested
   - Status: ⏳ Need to check definition first
   - Impact: Unknown - need to verify usage

### 🟡 Medium Priority (May Need Updating)

3. **`v_port_to_port_routes`**
   - Used by: Schedule integration service
   - Status: ⏳ Need to check definition
   - Impact: Medium - affects earliest departure feature

4. **`v_preferred_ofr`**
   - Used by: May be used in some queries
   - Status: ⏳ Need to check definition
   - Impact: Low-Medium - verify if actually used

### 🟢 Low Priority (Check First)

5. **`v_surcharges`**
   - Used by: May be used in some queries
   - Status: ⏳ Need to check definition
   - Impact: Low - verify if actually used

6. **`v_rms_ocean_ofr`**
   - Used by: Unknown
   - Status: ⏳ Need to check definition
   - Impact: Low - verify if actually used

7. **`v_active_surcharges`**
   - Used by: Unknown
   - Status: ⏳ Need to check definition
   - Impact: Low - verify if actually used

8. **`v_service_weekly_summary`**
   - Used by: Unknown
   - Status: ⏳ Need to check definition
   - Impact: Low - verify if actually used

9. **`v_voyage_routes_with_transit`**
   - Used by: Unknown
   - Status: ⏳ Need to check definition
   - Impact: Low - verify if actually used

10. **`v_weekly_vessel_schedule`**
    - Used by: Unknown
    - Status: ⏳ Need to check definition
    - Impact: Low - verify if actually used

---

## Schedule Views (schedules schema)

These are in the `schedules` schema and may not need updating:
- `v_dest_eta` - Used for schedules
- `v_next_departures` - Used for schedules
- `v_port_calls` - Used for schedules

**Note**: Schedule views may use different column names (e.g., `from_port`, `to_port`). Check definitions first.

---

## Archive Views (archive_2025_10_07 schema)

These are archived and likely don't need updating:
- All views in `archive_2025_10_07` schema

---

## Next Steps

1. Run `migrations/006_get_view_definitions.sql` to get definitions
2. Analyze which views actually reference pol/pod columns
3. Create migration scripts for views that need updating
4. Start with HIGH PRIORITY views first

---

## Migration Order

1. ✅ `mv_freight_sell_prices` - DONE
2. ⏳ `v_local_charges_details` - NEXT
3. ⏳ `v_freight_surcharge_details` - After v_local_charges_details
4. ⏳ `v_port_to_port_routes` - If needed for schedules
5. ⏳ Others - As needed

