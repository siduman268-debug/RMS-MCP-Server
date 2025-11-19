# Surcharge Schema Decision - KEEP CURRENT STRUCTURE

## Date: 2024-01-19

## Decision: NO MIGRATION - Keep existing schema

### Reason:
Production code heavily relies on current `applies_scope` values and location fields:
- V4 API quote preparation uses `applies_scope = 'origin'` and `'dest'`
- `v_local_charges_details` view queries these values
- API validation allows: `'origin'`, `'port'`, `'freight'`, `'dest'`, `'door'`, `'other'`

### Current Schema (KEEP AS-IS):
```sql
- applies_scope: 'origin', 'port', 'freight', 'dest', 'door', 'other'
- location_id: UUID (for single location surcharges)
- pol_id: UUID (for POL-specific or POL-POD pair)
- pod_id: UUID (for POD-specific or POL-POD pair)
```

### Usage Patterns:
1. **Origin/Port surcharges**: Use `location_id` or `pol_id`
2. **Destination/Door surcharges**: Use `location_id` or `pod_id`
3. **Freight surcharges**: Typically global (all NULL) or use `location_id`
4. **POL-POD pair**: Use both `pol_id` and `pod_id`

### LWC Form Strategy:
Instead of changing the database, update the LWC form to:
1. Keep `applies_scope` options as: 'origin', 'port', 'freight', 'dest', 'door', 'other'
2. Show location fields conditionally based on `applies_scope`:
   - 'origin' or 'port' → Show POL lookup (saves to `pol_id`)
   - 'dest' or 'door' → Show POD lookup (saves to `pod_id`)
   - 'freight' → Show optional location (saves to `location_id`)
   - Show "Both POL & POD" option for route-specific surcharges

### Next Steps:
1. ✅ Revert schema constants to match production values
2. ✅ Update LWC form with conditional location fields
3. ✅ Keep API as-is (already working correctly)
4. ✅ Test CRUD operations with existing data structure

