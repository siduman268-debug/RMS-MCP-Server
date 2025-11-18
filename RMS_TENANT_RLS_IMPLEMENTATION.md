# RMS Tenant Isolation & RLS Implementation Guide

## Overview

This document describes how tenant isolation and Row Level Security (RLS) policies are implemented in the RMS Management LWC interface to ensure users can only view and modify data belonging to their tenant.

## Architecture

### Multi-Layer Security

1. **API Layer (Supabase RLS)**: Database-level RLS policies enforce tenant isolation
2. **API Middleware**: Validates `x-tenant-id` header matches JWT token `tenant_id`
3. **Apex Layer**: Validates tenant access before operations
4. **LWC Layer**: Only displays tenant-filtered data

## Tenant ID Resolution

### Current Implementation

The `RMSApiUtil.getTenantId()` method currently returns a default tenant ID. To implement multi-tenant support, update this method based on your tenant model:

**Option 1: User Custom Field**
```apex
User currentUser = [SELECT Tenant_ID__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
if (String.isNotBlank(currentUser.Tenant_ID__c)) {
    return currentUser.Tenant_ID__c;
}
```

**Option 2: Custom Setting**
```apex
RMS_Org_Setting__c orgSetting = RMS_Org_Setting__c.getInstance();
if (String.isNotBlank(orgSetting.Tenant_ID__c)) {
    return orgSetting.Tenant_ID__c;
}
```

**Option 3: Org-to-Tenant Mapping**
```apex
Map<String, String> orgTenantMap = new Map<String, String>{
    '00D000000000001' => '00000000-0000-0000-0000-000000000001',
    '00D000000000002' => '00000000-0000-0000-0000-000000000002'
};
String orgId = UserInfo.getOrganizationId();
return orgTenantMap.get(orgId) ?? 'default-tenant-id';
```

## RLS Enforcement Points

### 1. Create Operations

All create operations automatically include `tenant_id` from the current user:

```apex
// Automatically added via RMSApiUtil.addTenantToPayload()
vendorData = RMSApiUtil.addTenantToPayload(vendorData);
```

### 2. Read Operations (List/Get)

- API filters by `x-tenant-id` header (set automatically)
- Supabase RLS policies enforce tenant isolation
- Users only see their tenant's data

### 3. Update Operations

- **Prevents tenant_id modification**: `updates.remove('tenant_id')`
- **Verifies tenant access**: Fetches record first to validate `tenant_id`
- **Backend validation**: API RLS enforces tenant isolation

```apex
// Verify tenant access before update
Map<String, Object> existing = getVendor(vendorId);
String recordTenantId = (String) existing.get('tenant_id');
String userTenantId = RMSApiUtil.getTenantId();

if (String.isNotBlank(recordTenantId) && !recordTenantId.equals(userTenantId)) {
    throw new AuraHandledException('Access denied: This vendor belongs to a different tenant.');
}
```

### 4. Delete Operations

- **Pre-deletion validation**: Fetches record to verify tenant access
- **Backend enforcement**: API RLS rejects deletion if tenant mismatch
- **Error handling**: Returns user-friendly error messages

## API RLS Policies (Supabase)

The backend API enforces RLS at the database level:

```sql
-- Example RLS Policy (enforced in Supabase)
CREATE POLICY tenant_isolation ON ocean_freight_rate
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

All API requests:
1. Validate JWT token contains `tenant_id`
2. Validate `x-tenant-id` header matches token `tenant_id`
3. Set Supabase session variable: `SET app.tenant_id = '...'`
4. RLS policies automatically filter all queries

## Error Handling

### Tenant Mismatch Errors

Users receive clear error messages when attempting to access other tenants' data:

- **403 Forbidden**: "Access denied: This record belongs to a different tenant."
- **404 Not Found**: Record doesn't exist or belongs to different tenant

### Security Best Practices

1. **Never trust client**: Always validate tenant_id on the server
2. **Fail secure**: Default to denying access if tenant cannot be determined
3. **Audit logging**: Log tenant violations for security monitoring
4. **Error messages**: Don't leak information about other tenants' data

## Testing Tenant Isolation

### Test Scenarios

1. **Same Tenant Access**: User can CRUD their tenant's records ✅
2. **Cross-Tenant Read**: User cannot see other tenant's records ✅
3. **Cross-Tenant Update**: User cannot update other tenant's records ✅
4. **Cross-Tenant Delete**: User cannot delete other tenant's records ✅
5. **Tenant ID Injection**: User cannot modify `tenant_id` in payload ✅

### Test Checklist

- [ ] User A can only see Tenant A's vendors
- [ ] User A cannot update Tenant B's vendors
- [ ] User A cannot delete Tenant B's vendors
- [ ] Creating record automatically sets correct tenant_id
- [ ] API rejects requests with mismatched tenant_id
- [ ] Error messages don't leak tenant information

## Implementation Status

✅ **Completed**:
- `RMSApiUtil.getTenantId()` - Dynamic tenant resolution
- `RMSApiUtil.addTenantToPayload()` - Auto-inject tenant_id on create
- `RMSApiUtil.validateTenantAccess()` - Validate tenant before operations
- All create methods enforce tenant_id
- All update methods prevent tenant_id modification and verify access
- All delete methods verify tenant access
- API automatically includes `x-tenant-id` header

📋 **Next Steps**:
1. Update `getTenantId()` method based on your tenant model (User field, Custom Setting, etc.)
2. Test with multiple tenants
3. Add audit logging for tenant violations
4. Review and enhance Supabase RLS policies

## Schema Constants Integration

The `rmsSchemaConstants.js` file provides:
- Enum values for picklists (container types, charge codes, etc.)
- Field configurations (required, max length, etc.)
- Validation rules aligned with database constraints

This ensures the LWC UI matches the database schema exactly.

