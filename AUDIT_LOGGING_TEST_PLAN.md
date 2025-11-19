# Audit Logging Test Plan

## ✅ Deployment Status
- **VM Docker**: Rebuilt and restarted successfully ✅
- **Code**: All audit logging integrated ✅
- **Git**: Pushed to master (commit b0a0d71) ✅

## 🧪 Testing Instructions

### Step 1: Test a Simple Operation
Go to your Salesforce RMS Management LWC and perform **ONE** simple operation:

**Recommended First Test: Create a Vendor**
1. Open RMS Management component
2. Go to "Vendors" tab
3. Click "Create"
4. Fill in:
   - Name: "Test Audit Vendor"
   - Type: "Freight Forwarder"
   - Mode: "Ocean"
5. Click "Save"
6. Note the success message

### Step 2: Check Audit Log in Supabase

Run this query in your Supabase SQL Editor:

```sql
-- Check the most recent audit entry
SELECT 
    id,
    table_name,
    action,
    record_id,
    tenant_id,
    source,
    created_at,
    new_values::jsonb AS new_values_formatted
FROM rms_audit_log
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- You should see an entry with:
  - `table_name`: "vendor"
  - `action`: "CREATE"
  - `record_id`: The ID of the vendor you just created
  - `new_values`: JSON object with name, vendor_type, mode, etc.
  - `source`: "SALESFORCE_LWC"

### Step 3: Test UPDATE Operation

1. Edit the vendor you just created
2. Change the name to "Test Audit Vendor Updated"
3. Save

Then run:

```sql
-- Check UPDATE audit
SELECT 
    id,
    table_name,
    action,
    record_id,
    changed_fields::jsonb AS changed_fields,
    old_values::jsonb AS old_values,
    new_values::jsonb AS new_values,
    created_at
FROM rms_audit_log
WHERE action = 'UPDATE'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- `changed_fields`: Should show `["name"]` or similar
- `old_values`: Should show original name
- `new_values`: Should show updated name

### Step 4: Test DELETE Operation

1. Delete the test vendor
2. Confirm deletion

Then run:

```sql
-- Check DELETE audit
SELECT 
    id,
    table_name,
    action,
    record_id,
    old_values::jsonb AS old_values,
    created_at
FROM rms_audit_log
WHERE action = 'DELETE'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- `old_values`: Should contain the full vendor record before deletion
- `new_values`: Should be NULL

### Step 5: Full Audit Trail Summary

```sql
-- Get complete audit trail for all tables today
SELECT 
    table_name,
    action,
    COUNT(*) as operation_count,
    MIN(created_at) as first_operation,
    MAX(created_at) as last_operation
FROM rms_audit_log
WHERE created_at >= CURRENT_DATE
GROUP BY table_name, action
ORDER BY table_name, action;
```

## 📋 Test Checklist

Test each entity type:

- [ ] **Vendors**: CREATE, UPDATE, DELETE
- [ ] **Contracts**: CREATE, UPDATE, DELETE
- [ ] **Ocean Freight**: CREATE, UPDATE, DELETE
- [ ] **Surcharges**: CREATE, UPDATE, DELETE
- [ ] **Margin Rules**: CREATE, UPDATE, DELETE

## 🎯 Success Criteria

✅ Each operation creates an audit log entry
✅ CREATE logs capture new record data
✅ UPDATE logs capture changed fields and old/new values
✅ DELETE logs capture deleted record data
✅ All entries have correct tenant_id
✅ All entries have correct timestamp
✅ Source is "SALESFORCE_LWC"

## 🐛 Troubleshooting

### If No Audit Entries Appear:

1. **Check API Logs**:
   ```bash
   docker logs rms-mcp-server --tail=100
   ```
   Look for any "Audit logging error" messages

2. **Verify Table Exists**:
   ```sql
   SELECT EXISTS (
       SELECT FROM information_schema.tables 
       WHERE table_name = 'rms_audit_log'
   );
   ```

3. **Check RLS Policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'rms_audit_log';
   ```

4. **Manual Audit Test** (from API directly):
   Use the RMS API endpoints with your tenant token and verify operations work

## 📊 Sample Audit Query (Pretty Format)

```sql
-- Pretty print the last 10 audit entries
SELECT 
    id,
    table_name || ' #' || record_id AS affected_record,
    action,
    CASE 
        WHEN changed_fields IS NOT NULL 
        THEN jsonb_pretty(changed_fields::jsonb)
        ELSE 'N/A'
    END as fields_changed,
    to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as when_changed,
    source
FROM rms_audit_log
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎉 Once Testing is Complete

Report back with:
1. ✅ Audit entries are being created
2. 📊 Screenshot or copy-paste of sample audit entries
3. 🐛 Any issues encountered

Then we can move on to any additional features or improvements needed!

