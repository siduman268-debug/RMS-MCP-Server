# Contracts CRUD Checklist

## Issues Found from Vendors Tab:
1. ✅ Missing `name` field requirement (already required in schema)
2. ⚠️ DELETE endpoint needs dependency check (ocean_freight_rate references contract_id)
3. ⚠️ DELETE endpoint needs audit logging
4. ⚠️ DELETE endpoint needs better error messages
5. ⚠️ POST/PUT endpoints need audit logging
6. ✅ API exists but needs improvements

## Required Changes:

### 1. API (src/index.ts)
- [x] Add dependency check in DELETE (check ocean_freight_rate table)
- [ ] Add audit logging to POST
- [ ] Add audit logging to PUT
- [ ] Add audit logging to DELETE
- [ ] Add extensive logging like vendors
- [ ] Ensure `name` is required in validation

### 2. Schema Constants (Already Correct)
- ✅ `vendor_id`: lookup, required
- ✅ `name`: text, required
- ✅ `mode`: picklist, required (OCEAN, AIR, RAIL, TRUCK)
- ✅ `is_spot`: checkbox, defaultValue: true
- ✅ `effective_from`: date, required
- ✅ `effective_to`: date, required
- ✅ `currency`: picklist, required, defaultValue: USD
- ✅ `source_ref`: text, optional
- ✅ `terms`: textarea, optional (JSON)

### 3. Apex (Already Exists)
- RMSContractService.cls exists with all CRUD methods

### 4. UI Refresh
- Already fixed in rmsManagement.js (loadContracts uses [...data])

## Database Schema (from user's previous output):
```json
[
  { "column_name": "id", "data_type": "bigint", "is_nullable": "NO" },
  { "column_name": "vendor_id", "data_type": "bigint", "is_nullable": "NO" },
  { "column_name": "mode", "data_type": "text", "is_nullable": "NO" },
  { "column_name": "name", "data_type": "text", "is_nullable": "NO" },
  { "column_name": "effective_from", "data_type": "date", "is_nullable": "NO" },
  { "column_name": "effective_to", "data_type": "date", "is_nullable": "NO" },
  { "column_name": "is_spot", "data_type": "boolean", "is_nullable": "NO", "column_default": "true" },
  { "column_name": "currency", "data_type": "text", "is_nullable": "NO" },
  { "column_name": "source_ref", "data_type": "text", "is_nullable": "YES" },
  { "column_name": "terms", "data_type": "jsonb", "is_nullable": "NO", "column_default": "'{}'::jsonb" },
  { "column_name": "tenant_id", "data_type": "uuid", "is_nullable": "NO" },
  { "column_name": "contract_number", "data_type": "text", "is_nullable": "YES" }
]
```

## Action Plan:
1. Update DELETE endpoint with dependency check + audit
2. Update POST endpoint with audit logging
3. Update PUT endpoint with audit logging
4. Deploy and test

## Test Plan:
1. Create contract → Should work and log audit
2. Edit contract → Should work and log audit
3. Delete contract (with rates) → Should show error about dependencies
4. Delete contract (without rates) → Should work and log audit

