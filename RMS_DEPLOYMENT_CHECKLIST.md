# RMS Management LWC - Deployment Checklist

## Overview

This checklist covers deploying the RMS Management LWC with configurable RBAC and tenant isolation to your Salesforce org.

## Pre-Deployment

### 1. Verify Prerequisites

- [ ] Salesforce Org with API access enabled
- [ ] Named Credential `RMS_API` configured with your RMS API endpoint
- [ ] User with System Administrator permissions
- [ ] Access to Salesforce CLI (`sf` command)
- [ ] RMS API credentials (for tenant isolation)

### 2. Review Configuration

- [ ] Review `RMS_TENANT_RLS_IMPLEMENTATION.md` for tenant isolation setup
- [ ] Review `RMS_CONFIGURABLE_RBAC_GUIDE.md` for RBAC configuration
- [ ] Decide on tenant ID resolution method (User field, Custom Setting, or default)
- [ ] Plan your role structure (e.g., PRICING_USER, SALES_USER, etc.)

## Deployment Steps

### Step 1: Deploy Apex Classes

Deploy all Apex classes (these enforce tenant isolation and RBAC):

```bash
sf project deploy start --source-dir force-app/main/default/classes
```

**Files to Deploy:**
- [ ] `RMSApiUtil.cls` - API utility with tenant ID resolution
- [ ] `RMSPermissionService.cls` - RBAC permission service
- [ ] `RMSVendorService.cls` - Vendor CRUD with permissions
- [ ] `RMSContractService.cls` - Contract CRUD with permissions
- [ ] `OceanFreightRateService.cls` - Rate CRUD with permissions
- [ ] `SurchargeService.cls` - Surcharge CRUD with permissions
- [ ] `MarginRuleService.cls` - Margin Rule CRUD with permissions

### Step 2: Deploy Custom Metadata Type

Deploy Custom Metadata Type and fields:

```bash
sf project deploy start --source-dir force-app/main/default/objects/RMS_Role_Permission__mdt
```

**Files to Deploy:**
- [ ] `RMS_Role_Permission__mdt.object-meta.xml` - Custom Metadata Type
- [ ] `Role__c.field-meta.xml` - Role field
- [ ] `Entity__c.field-meta.xml` - Entity field
- [ ] `Permissions__c.field-meta.xml` - Permissions field
- [ ] `Viewable_Fields__c.field-meta.xml` - Viewable Fields field
- [ ] `Profile_Mapping__c.field-meta.xml` - Profile Mapping field
- [ ] `Permission_Set_Mapping__c.field-meta.xml` - Permission Set Mapping field

### Step 3: Deploy Sample Custom Metadata Records (Optional)

Deploy sample Custom Metadata records:

```bash
sf project deploy start --source-dir force-app/main/default/customMetadata
```

**Sample Records Included:**
- [ ] `Pricing_User_Profile` - Maps Pricing profiles to PRICING_USER role
- [ ] `Pricing_User_Vendor` - Pricing user vendor permissions
- [ ] `Pricing_User_Contract` - Pricing user contract permissions
- [ ] `Pricing_User_Rate` - Pricing user rate permissions (with buy_amount)
- [ ] `Pricing_User_Surcharge` - Pricing user surcharge permissions
- [ ] `Pricing_User_Margin_Rule` - Pricing user margin rule permissions
- [ ] `Sales_User_Permission_Set` - Maps Sales permission sets to SALES_USER role
- [ ] `Sales_User_Rate` - Sales user rate permissions (without buy_amount)
- [ ] `Sales_User_Surcharge` - Sales user surcharge permissions

**Note:** Customize these records to match your org's Profiles and Permission Sets!

### Step 4: Deploy LWC Components

Deploy LWC components:

```bash
sf project deploy start --source-dir force-app/main/default/lwc
```

**Components to Deploy:**
- [ ] `rmsManagement` - Main RMS management component
- [ ] `rmsVendorsTable` - Vendors table component
- [ ] `rmsContractsTable` - Contracts table component
- [ ] `rmsRatesTable` - Rates table component
- [ ] `rmsSurchargesTable` - Surcharges table component
- [ ] `rmsMarginRulesTable` - Margin Rules table component
- [ ] `rmsModalForm` - Generic modal form component
- [ ] `rmsSchemaConstants` - Schema constants (if exists)

### Step 5: Configure Named Credential

Verify/Configure Named Credential:

1. Go to **Setup → Named Credentials**
2. Find `RMS_API`
3. Configure:
   - [ ] URL: Your RMS API endpoint (e.g., `https://your-api-domain.com`)
   - [ ] Authentication: OAuth 2.0 or Certificate (as per your API)
   - [ ] Identity Type: Named Principal
   - [ ] Test connection

### Step 6: Configure Tenant ID Resolution

Update `RMSApiUtil.getTenantId()` based on your tenant model:

**Option 1: User Custom Field**
```apex
// Uncomment in RMSApiUtil.cls
User currentUser = [SELECT Tenant_ID__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
if (String.isNotBlank(currentUser.Tenant_ID__c)) {
    return currentUser.Tenant_ID__c;
}
```

**Option 2: Custom Setting**
```apex
// Uncomment and configure in RMSApiUtil.cls
RMS_Org_Setting__c orgSetting = RMS_Org_Setting__c.getInstance();
if (String.isNotBlank(orgSetting.Tenant_ID__c)) {
    return orgSetting.Tenant_ID__c;
}
```

**Option 3: Default (Single Tenant)**
- [ ] Keep default tenant ID (no changes needed)

### Step 7: Configure RBAC (Custom Metadata)

#### Option A: Use Sample Records

1. Review sample Custom Metadata records in `force-app/main/default/customMetadata/`
2. Update Profile/Permission Set names to match your org:
   - [ ] `Pricing_User_Profile`: Update `Profile_Mapping__c` with your Pricing profile names
   - [ ] `Sales_User_Permission_Set`: Update `Permission_Set_Mapping__c` with your Sales permission set names

#### Option B: Create Custom Records

1. Go to **Setup → Custom Metadata Types**
2. Click **RMS Role Permission**
3. Create records for each role/entity combination:
   - [ ] Profile/Permission Set mappings
   - [ ] Entity permissions (VIEW, CREATE, EDIT, DELETE)
   - [ ] Field-level security (Viewable Fields)

**Reference:** See `RMS_CONFIGURABLE_RBAC_GUIDE.md` for detailed examples.

### Step 8: Create/Update Profiles/Permission Sets (Optional)

If using Profiles or Permission Sets for role mapping:

**Profiles:**
- [ ] Create/Update Profiles (e.g., "RMS Pricing Manager", "RMS Sales User")
- [ ] Assign users to appropriate profiles

**Permission Sets:**
- [ ] Create Permission Sets (e.g., "RMS_PRICING_USER", "RMS_SALES_USER")
- [ ] Assign permission sets to users
- [ ] Update Custom Metadata `Permission_Set_Mapping__c` with permission set names

### Step 9: Create App Page

1. Go to **Lightning App Builder**
2. Create new **App Page**:
   - [ ] Name: "RMS Management"
   - [ ] Drag `rmsManagement` component onto page
   - [ ] Activate page
   - [ ] Add to Navigation Menu (optional)

### Step 10: Test Deployment

## Testing Checklist

### Tenant Isolation Testing

- [ ] **Tenant ID Resolution**: Verify `RMSApiUtil.getTenantId()` returns correct tenant ID
- [ ] **API Calls**: Verify all API calls include `x-tenant-id` header
- [ ] **Create Operations**: Verify new records automatically get tenant_id
- [ ] **Read Operations**: Verify users only see their tenant's data
- [ ] **Update Operations**: Verify users cannot update other tenant's records
- [ ] **Delete Operations**: Verify users cannot delete other tenant's records

### RBAC Testing

#### Pricing User Tests

- [ ] Can view all entities (Vendors, Contracts, Rates, Surcharges, Margin Rules)
- [ ] Can create/edit/delete all entities
- [ ] Can view `buy_amount` field in rates (field-level security)
- [ ] Can mark rates as preferred
- [ ] Can create/edit margin rules

#### Sales User Tests

- [ ] Can view rates (read-only)
- [ ] Cannot view `buy_amount` field in rates (field is hidden)
- [ ] Cannot create/edit/delete rates
- [ ] Cannot view margin rules (no access)
- [ ] Can create/edit/delete surcharges
- [ ] Can view vendors and contracts (read-only)

#### Sales Read-Only User Tests

- [ ] Cannot view rates at all (entity not accessible)
- [ ] Cannot view margin rules (entity not accessible)
- [ ] Can only view vendors, contracts, surcharges (no edit/create/delete)

### LWC Component Testing

- [ ] **Main Component**: `rmsManagement` loads without errors
- [ ] **Tabs**: All tabs (Vendors, Contracts, Rates, Surcharges, Margin Rules) display
- [ ] **Tables**: Data tables display records correctly
- [ ] **Create**: "Create New" button opens modal and saves records
- [ ] **Edit**: "Edit" action opens modal and updates records
- [ ] **View**: "View" action opens read-only modal
- [ ] **Delete**: "Delete" action confirms and deletes records
- [ ] **Bulk Upload**: CSV upload functionality works
- [ ] **Filtering**: Filters work correctly per role permissions
- [ ] **Field Hiding**: Sensitive fields hidden based on role

### Error Handling Testing

- [ ] **Permission Denied**: User receives clear error when lacking permission
- [ ] **Tenant Mismatch**: User receives clear error when accessing other tenant's data
- [ ] **API Errors**: API errors display user-friendly messages
- [ ] **Validation Errors**: Field validation works correctly

## Post-Deployment

### 1. User Training

- [ ] Train pricing users on managing rates and margin rules
- [ ] Train sales users on viewing rates (without buy_amount) and managing surcharges
- [ ] Train operations users on managing vendors and contracts

### 2. Documentation

- [ ] Share `RMS_CONFIGURABLE_RBAC_GUIDE.md` with admins
- [ ] Share `RMS_TENANT_RLS_IMPLEMENTATION.md` with technical team
- [ ] Document org-specific role configurations

### 3. Monitoring

- [ ] Monitor permission violations in debug logs
- [ ] Monitor API call patterns
- [ ] Monitor tenant isolation compliance
- [ ] Set up alerts for unauthorized access attempts

## Troubleshooting

### Common Issues

**Issue**: Users see "Access denied" errors
- **Solution**: Check Custom Metadata role mappings and permissions

**Issue**: Users can see other tenant's data
- **Solution**: Verify `RMSApiUtil.getTenantId()` returns correct tenant ID

**Issue**: Fields not hiding based on role
- **Solution**: Check `Viewable_Fields__c` in Custom Metadata matches field names exactly

**Issue**: Permission checks not working
- **Solution**: Verify Custom Metadata records exist and are configured correctly

### Debug Steps

1. **Check Role Resolution**:
   ```apex
   String userRole = RMSPermissionService.getUserRole();
   System.debug('User Role: ' + userRole);
   ```

2. **Check Permissions**:
   ```apex
   Boolean canView = RMSPermissionService.hasPermission('RATE', 'VIEW');
   System.debug('Can View Rates: ' + canView);
   ```

3. **Check Tenant ID**:
   ```apex
   String tenantId = RMSApiUtil.getTenantId();
   System.debug('Tenant ID: ' + tenantId);
   ```

## Rollback Plan

If issues occur, rollback in reverse order:

1. [ ] Remove LWC components from App Pages
2. [ ] Delete Custom Metadata records
3. [ ] Delete Custom Metadata Type
4. [ ] Delete Apex classes (will revert to defaults)

**Note:** Default hardcoded permissions will apply if Custom Metadata is removed.

## Success Criteria

✅ All Apex classes deploy without errors
✅ Custom Metadata Type deploys successfully
✅ LWC components render correctly
✅ Users can access appropriate data based on role
✅ Tenant isolation prevents cross-tenant access
✅ Field-level security hides sensitive fields
✅ All CRUD operations work correctly
✅ Bulk upload functionality works
✅ Error messages are user-friendly

## Next Steps After Deployment

1. **Customize Roles**: Update Custom Metadata to match your org's needs
2. **Create Profiles/Permission Sets**: Set up role mappings as needed
3. **Test Thoroughly**: Verify all scenarios with test users
4. **Train Users**: Provide training on new interface
5. **Monitor Usage**: Track permission usage and adjust as needed

---

**Need Help?** Refer to:
- `RMS_CONFIGURABLE_RBAC_GUIDE.md` - RBAC configuration guide
- `RMS_TENANT_RLS_IMPLEMENTATION.md` - Tenant isolation guide
- `RMS_RBAC_IMPLEMENTATION.md` - RBAC implementation details

