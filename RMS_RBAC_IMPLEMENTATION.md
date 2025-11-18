# RMS Role-Based Access Control (RBAC) Implementation Guide

## Overview

This document describes the Role-Based Access Control (RBAC) system implemented for the RMS Management LWC interface. The system provides fine-grained access control at both the entity level and field level, ensuring users can only access data and perform actions based on their role.

## Architecture

### Multi-Layer Security

1. **Role Resolution**: Determines user's role from Profile, Permission Sets, or Custom Field
2. **Entity-Level Permissions**: Controls which entities (Vendors, Rates, Surcharges, Margin Rules) users can view/edit/delete
3. **Field-Level Permissions**: Controls which fields users can view (e.g., `buy_amount` is secret for sales users)
4. **Tenant Isolation**: Works in conjunction with RLS to ensure multi-tenant isolation

## Role Definitions

### Available Roles

1. **ADMIN** - System Administrator
   - Full access to all entities and fields
   - Can perform all operations (view, create, edit, delete)

2. **PRICING_USER** - Pricing Manager/User
   - Full access to all entities including sensitive pricing data
   - Can view `buy_amount` (secret field)
   - Can create/edit margin rules (pricing only)
   - Can mark rates as preferred

3. **SALES_USER** - Sales Manager/User
   - Can view rates but NOT `buy_amount` (field-level security)
   - Can create/edit surcharges
   - Cannot view or edit margin rules
   - Cannot mark rates as preferred

4. **SALES_READONLY** - Sales Read-Only
   - Can view vendors, contracts, and surcharges
   - Cannot view rates (completely hidden - secret)
   - Cannot view margin rules
   - No edit/create/delete permissions

5. **OPERATIONS_USER** - Operations User
   - Can edit vendors and contracts
   - Cannot view rates or margin rules (pricing data is secret)
   - Can view surcharges (read-only)

## Permission Matrix

### Entity-Level Permissions

| Role | Vendors | Contracts | Rates | Surcharges | Margin Rules |
|------|---------|-----------|-------|------------|--------------|
| **ADMIN** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **PRICING_USER** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **SALES_USER** | 👁️ View | 👁️ View | 👁️ View* | ✅ All | ❌ No Access |
| **SALES_READONLY** | 👁️ View | 👁️ View | ❌ No Access | 👁️ View | ❌ No Access |
| **OPERATIONS_USER** | ✅ All | ✅ All | ❌ No Access | 👁️ View | ❌ No Access |

*SALES_USER can view rates but NOT `buy_amount` field (field-level security)

### Field-Level Permissions (Rates)

| Role | buy_amount | sell_amount | margin | Other Fields |
|------|------------|-------------|--------|--------------|
| **PRICING_USER** | ✅ View | ✅ View | ✅ View | ✅ View |
| **SALES_USER** | ❌ Hidden | ✅ View | ✅ View | ✅ View |
| **SALES_READONLY** | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access |
| **OPERATIONS_USER** | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access |

## Implementation Details

### 1. Role Resolution

The `RMSPermissionService.getUserRole()` method determines the user's role through multiple mechanisms (in order of precedence):

1. **Profile Name Mapping**: Maps standard Salesforce profiles to RMS roles
   ```apex
   'RMS Pricing Manager' => 'PRICING_USER'
   'RMS Sales User' => 'SALES_USER'
   ```

2. **Permission Set Assignment**: Checks for permission sets like `RMS_PRICING_USER`, `RMS_SALES_USER`

3. **Custom User Field**: (Optional) Can check `User.RMS_Role__c` if configured

4. **Default**: Falls back to `SALES_READONLY` (most restrictive - fail secure)

### 2. Permission Checking

#### Entity-Level Permissions

```apex
// Check if user can view rates
RMSPermissionService.validatePermission(
    RMSPermissionService.ENTITY_RATE, 
    RMSPermissionService.PERMISSION_VIEW
);

// Check if user can edit margin rules
RMSPermissionService.validatePermission(
    RMSPermissionService.ENTITY_MARGIN_RULE, 
    RMSPermissionService.PERMISSION_EDIT
);
```

#### Field-Level Permissions

```apex
// Check if user can view buy_amount (secret field)
Boolean canViewBuyAmount = RMSPermissionService.canViewField(
    RMSPermissionService.ENTITY_RATE, 
    'buy_amount'
);

// Filter fields from record
Map<String, Object> filteredRecord = RMSPermissionService.filterFieldsByPermission(
    rateRecord, 
    RMSPermissionService.ENTITY_RATE
);
```

### 3. Integration with Service Classes

All service classes now include permission checks:

```apex
// Example: OceanFreightRateService.listRatesForLWC()
@AuraEnabled(cacheable=true)
public static List<Map<String, Object>> listRatesForLWC(String filtersJson) {
    // 1. Check view permission
    RMSPermissionService.validatePermission(
        RMSPermissionService.ENTITY_RATE, 
        RMSPermissionService.PERMISSION_VIEW
    );
    
    // 2. Fetch data from API
    
    // 3. Filter fields based on field-level permissions
    return RMSPermissionService.filterRecordsByPermission(rates, ENTITY_RATE);
}
```

## Configuration

### Option 1: Profile-Based (Recommended for Standard Setup)

Create Salesforce Profiles:
- **RMS Pricing Manager** → Maps to `PRICING_USER`
- **RMS Sales Manager** → Maps to `SALES_USER`
- **RMS Sales Read Only** → Maps to `SALES_READONLY`
- **RMS Operations** → Maps to `OPERATIONS_USER`

Update `RMSPermissionService.getUserRole()` profile mapping:

```apex
Map<String, String> profileToRoleMap = new Map<String, String>{
    'RMS Pricing Manager' => 'PRICING_USER',
    'RMS Sales Manager' => 'SALES_USER',
    'RMS Sales Read Only' => 'SALES_READONLY',
    'RMS Operations' => 'OPERATIONS_USER'
};
```

### Option 2: Permission Set-Based (Recommended for Flexible Setup)

Create Permission Sets:
- **RMS_PRICING_USER** → Assigns `PRICING_USER` role
- **RMS_SALES_USER** → Assigns `SALES_USER` role
- **RMS_SALES_READONLY** → Assigns `SALES_READONLY` role
- **RMS_OPERATIONS_USER** → Assigns `OPERATIONS_USER` role

Assign permission sets to users as needed.

### Option 3: Custom User Field (Recommended for Dynamic Setup)

1. Create custom field on User: `RMS_Role__c` (Picklist)
   - Values: `PRICING_USER`, `SALES_USER`, `SALES_READONLY`, `OPERATIONS_USER`

2. Update `RMSPermissionService.getUserRole()`:

```apex
User currentUser = [SELECT RMS_Role__c FROM User WHERE Id = :UserInfo.getUserId()];
if (String.isNotBlank(currentUser.RMS_Role__c)) {
    return currentUser.RMS_Role__c;
}
```

## LWC Integration

### Getting User Permissions

```javascript
import getUserPermissions from '@salesforce/apex/RMSPermissionService.getUserPermissions';

// In component
async connectedCallback() {
    this.userPermissions = await getUserPermissions();
    
    // Check if user can view rates
    if (this.userPermissions.RATE?.VIEW) {
        this.loadRates();
    }
    
    // Check if user can edit margin rules
    if (this.userPermissions.MARGIN_RULE?.EDIT) {
        this.showEditButton = true;
    }
}
```

### Conditional Rendering

```html
<!-- Show rates tab only if user can view rates -->
<lightning-tab if:true={canViewRates} label="Rates" value="rates">
    <!-- ... -->
</lightning-tab>

<!-- Show edit button only if user can edit -->
<lightning-button 
    if:true={canEditMarginRules} 
    label="Edit" 
    onclick={handleEdit}>
</lightning-button>

<!-- Hide buy_amount field for sales users -->
<lightning-input
    if:true={canViewBuyAmount}
    label="Buy Amount"
    value={rate.buy_amount}>
</lightning-input>
```

## Security Best Practices

1. **Fail Secure**: Default to most restrictive permissions if role cannot be determined
2. **Defense in Depth**: Check permissions at multiple layers (Apex, LWC, API)
3. **Field-Level Filtering**: Always filter sensitive fields before returning data
4. **Audit Logging**: Log permission violations for security monitoring
5. **Tenant Isolation**: RBAC works in conjunction with RLS - both must pass

## Testing Checklist

- [ ] Pricing user can view all entities including rates with `buy_amount`
- [ ] Sales user can view rates but NOT `buy_amount` field
- [ ] Sales user cannot view or edit margin rules
- [ ] Sales readonly user cannot view rates at all
- [ ] Operations user cannot view pricing data (rates, margin rules)
- [ ] Users cannot edit entities they don't have permission for
- [ ] Users cannot delete entities they don't have permission for
- [ ] Field filtering removes sensitive fields from API responses
- [ ] LWC respects permissions and hides/show UI elements accordingly

## Future Enhancements

1. **Custom Metadata Types**: Store permission matrix in Custom Metadata for easier configuration
2. **Dynamic Permissions**: Allow per-user permission overrides
3. **Audit Trail**: Log all permission checks and violations
4. **Permission Inheritance**: Support hierarchical roles (e.g., Manager inherits User permissions)
5. **Time-Based Permissions**: Support temporary access grants

