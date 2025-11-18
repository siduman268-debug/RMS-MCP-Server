# RMS Configurable RBAC Implementation Guide

## Overview

The RMS Role-Based Access Control (RBAC) system is now **fully configurable per org** using **Custom Metadata Types**. Each Salesforce org can define their own roles, permissions, and field-level security without any code changes.

## Architecture

### Custom Metadata Type: `RMS_Role_Permission__mdt`

Each record in this Custom Metadata Type defines:
- **Role**: The role identifier (e.g., `PRICING_USER`, `SALES_USER`, `ADMIN`)
- **Entity**: The entity name (e.g., `VENDOR`, `RATE`, `SURCHARGE`, `MARGIN_RULE`)
- **Permissions**: Comma-separated list of permissions (e.g., `VIEW,CREATE,EDIT,DELETE`)
- **Viewable Fields**: Comma-separated list of field names users in this role can view (field-level security)
- **Profile Mapping**: Comma-separated list of Salesforce Profile names that map to this role
- **Permission Set Mapping**: Comma-separated list of Permission Set names that map to this role

## Setup Instructions

### Step 1: Deploy Custom Metadata Type

Deploy the Custom Metadata Type and fields:
- `RMS_Role_Permission__mdt` (Custom Metadata Type)
- `Role__c` (Text)
- `Entity__c` (Text)
- `Permissions__c` (Text)
- `Viewable_Fields__c` (Long Text Area)
- `Profile_Mapping__c` (Long Text Area)
- `Permission_Set_Mapping__c` (Long Text Area)

### Step 2: Configure Role Mappings

Create Custom Metadata records to map Salesforce Profiles/Permission Sets to RMS roles:

**Example: Map Profile to Role**
```
Label: Pricing Manager Profile Mapping
Role__c: PRICING_USER
Profile_Mapping__c: RMS Pricing Manager, RMS Pricing User
```

**Example: Map Permission Set to Role**
```
Label: Sales User Permission Set Mapping
Role__c: SALES_USER
Permission_Set_Mapping__c: RMS_SALES_USER, RMS_SALES_MANAGER
```

### Step 3: Configure Entity Permissions

Create Custom Metadata records to define what each role can do with each entity:

**Example: Pricing User - Full Access to Rates**
```
Label: Pricing User Rate Permissions
Role__c: PRICING_USER
Entity__c: RATE
Permissions__c: VIEW,CREATE,EDIT,DELETE,MARK_PREFERRED
Viewable_Fields__c: id,pol_code,pod_code,container_type,buy_amount,currency,tt_days,valid_from,valid_to,is_preferred
```

**Example: Sales User - Read-Only Access to Rates (without buy_amount)**
```
Label: Sales User Rate Permissions
Role__c: SALES_USER
Entity__c: RATE
Permissions__c: VIEW
Viewable_Fields__c: id,pol_code,pod_code,container_type,currency,tt_days,valid_from,valid_to,is_preferred
```
*Note: `buy_amount` is NOT in the viewable fields list - it's secret for sales users!*

**Example: Sales User - Full Access to Surcharges**
```
Label: Sales User Surcharge Permissions
Role__c: SALES_USER
Entity__c: SURCHARGE
Permissions__c: VIEW,CREATE,EDIT,DELETE
Viewable_Fields__c: (leave empty to allow all fields)
```

**Example: Sales User - No Access to Margin Rules**
```
Label: Sales User Margin Rule Permissions
Role__c: SALES_USER
Entity__c: MARGIN_RULE
Permissions__c: (leave empty - no permissions)
Viewable_Fields__c: (leave empty - no fields viewable)
```

## Permission Values

### Entity Permissions
- `VIEW`: Can view/list records
- `CREATE`: Can create new records
- `EDIT`: Can update existing records
- `DELETE`: Can delete records
- `MARK_PREFERRED`: Can mark rates as preferred (rates only)

### Entity Types
- `VENDOR`: Vendor management
- `CONTRACT`: Rate contract management
- `RATE`: Ocean freight rate management
- `SURCHARGE`: Surcharge management
- `MARGIN_RULE`: Margin rule management

## Field-Level Security

### Viewable Fields Logic

1. **Whitelist Approach (Recommended)**: If `Viewable_Fields__c` is populated, only those fields are viewable
   - Example: `id,pol_code,pod_code` means user can ONLY see those 3 fields

2. **Blacklist Approach (Default)**: If `Viewable_Fields__c` is empty, all fields are viewable EXCEPT sensitive fields
   - Sensitive fields (always denied): `buy_amount`, `sell_amount`, `margin`

### Sensitive Fields

By default, these fields are considered sensitive and hidden unless explicitly allowed:
- `buy_amount`: Purchase price (secret for sales users)
- `sell_amount`: Selling price
- `margin`: Profit margin

## Example Configurations

### Complete Pricing User Setup

```xml
<!-- Profile Mapping -->
<CustomMetadata>
    <label>Pricing Manager Profile</label>
    <protected>false</protected>
    <values>
        <field>Role__c</field>
        <value>PRICING_USER</value>
    </values>
    <values>
        <field>Profile_Mapping__c</field>
        <value>RMS Pricing Manager, RMS Pricing User</value>
    </values>
</CustomMetadata>

<!-- Rate Permissions -->
<CustomMetadata>
    <label>Pricing User Rates</label>
    <protected>false</protected>
    <values>
        <field>Role__c</field>
        <value>PRICING_USER</value>
    </values>
    <values>
        <field>Entity__c</field>
        <value>RATE</value>
    </values>
    <values>
        <field>Permissions__c</field>
        <value>VIEW,CREATE,EDIT,DELETE,MARK_PREFERRED</value>
    </values>
    <values>
        <field>Viewable_Fields__c</field>
        <value>id,pol_code,pod_code,container_type,buy_amount,currency,tt_days,valid_from,valid_to,is_preferred</value>
    </values>
</CustomMetadata>

<!-- Margin Rule Permissions -->
<CustomMetadata>
    <label>Pricing User Margin Rules</label>
    <protected>false</protected>
    <values>
        <field>Role__c</field>
        <value>PRICING_USER</value>
    </values>
    <values>
        <field>Entity__c</field>
        <value>MARGIN_RULE</value>
    </values>
    <values>
        <field>Permissions__c</field>
        <value>VIEW,CREATE,EDIT,DELETE</value>
    </values>
</CustomMetadata>
```

### Complete Sales User Setup

```xml
<!-- Permission Set Mapping -->
<CustomMetadata>
    <label>Sales User Permission Set</label>
    <protected>false</protected>
    <values>
        <field>Role__c</field>
        <value>SALES_USER</value>
    </values>
    <values>
        <field>Permission_Set_Mapping__c</field>
        <value>RMS_SALES_USER, RMS_SALES_MANAGER</value>
    </values>
</CustomMetadata>

<!-- Rate Permissions (Read-only, no buy_amount) -->
<CustomMetadata>
    <label>Sales User Rates</label>
    <protected>false</protected>
    <values>
        <field>Role__c</field>
        <value>SALES_USER</value>
    </values>
    <values>
        <field>Entity__c</field>
        <value>RATE</value>
    </values>
    <values>
        <field>Permissions__c</field>
        <value>VIEW</value>
    </values>
    <values>
        <field>Viewable_Fields__c</field>
        <value>id,pol_code,pod_code,container_type,currency,tt_days,valid_from,valid_to,is_preferred</value>
        <!-- Note: buy_amount is NOT included - it's secret! -->
    </values>
</CustomMetadata>

<!-- Surcharge Permissions (Full access) -->
<CustomMetadata>
    <label>Sales User Surcharges</label>
    <protected>false</protected>
    <values>
        <field>Role__c</field>
        <value>SALES_USER</value>
    </values>
    <values>
        <field>Entity__c</field>
        <value>SURCHARGE</value>
    </values>
    <values>
        <field>Permissions__c</field>
        <value>VIEW,CREATE,EDIT,DELETE</value>
    </values>
    <!-- Viewable_Fields__c left empty = all fields viewable -->
</CustomMetadata>

<!-- Margin Rule Permissions (No access) -->
<CustomMetadata>
    <label>Sales User Margin Rules</label>
    <protected>false</protected>
    <values>
        <field>Role__c</field>
        <value>SALES_USER</value>
    </values>
    <values>
        <field>Entity__c</field>
        <value>MARGIN_RULE</value>
    </values>
    <values>
        <field>Permissions__c</field>
        <value></value>
        <!-- Empty = no permissions -->
    </values>
</CustomMetadata>
```

## How It Works

### Role Resolution Order

1. **Custom Metadata Profile Mapping**: Checks if user's Profile matches any Custom Metadata record
2. **Custom Metadata Permission Set Mapping**: Checks if user has any Permission Sets matching Custom Metadata
3. **Custom User Field**: Checks `User.RMS_Role__c` if field exists
4. **Default Hardcoded Mappings**: Falls back to hardcoded defaults (backward compatible)

### Permission Checking

1. **Load Custom Metadata**: Reads `RMS_Role_Permission__mdt` records
2. **Build Permission Matrix**: Creates in-memory map of Role → Entity → Permissions
3. **Check Permission**: Validates user's role has required permission for entity
4. **Field Filtering**: Removes fields user cannot view before returning data

### Caching

Permission matrices are cached in memory for performance:
- `cachedRolePermissions`: Entity-level permissions
- `cachedFieldPermissions`: Field-level permissions
- `cachedProfileToRole`: Profile to role mappings
- `cachedPermissionSetToRole`: Permission set to role mappings

## Deployment

### Option 1: Metadata Deployment (Recommended)

Create `.cls-meta.xml` files in `force-app/main/default/customMetadata/`:

```
force-app/main/default/customMetadata/
├── RMS_Role_Permission.Pricing_User_Profile.md-meta.xml
├── RMS_Role_Permission.Pricing_User_Rates.md-meta.xml
├── RMS_Role_Permission.Sales_User_Permission_Set.md-meta.xml
├── RMS_Role_Permission.Sales_User_Rates.md-meta.xml
└── ...
```

### Option 2: Setup UI (If Enabled)

If Custom Metadata Type is configured for UI editing:
1. Go to Setup → Custom Metadata Types
2. Click on `RMS Role Permission`
3. Click "New" to create records
4. Fill in fields and save

### Option 3: Apex/DML (Not Recommended)

Custom Metadata Types are **protected** by default and cannot be created/updated via DML. Use metadata deployment or UI only.

## Backward Compatibility

If **no Custom Metadata records exist**, the system falls back to **default hardcoded permissions**:
- Default role mappings (Profile names)
- Default permission matrix
- Default field permissions

This ensures existing orgs continue working without configuration.

## Best Practices

1. **Start with Defaults**: Use default permissions as a template, customize as needed
2. **Test in Sandbox**: Always test permission configurations in Sandbox first
3. **Document Changes**: Keep a spreadsheet of role/permission configurations
4. **Version Control**: Include Custom Metadata in your version control
5. **Fail Secure**: If role cannot be determined, defaults to most restrictive (`SALES_READONLY`)

## Troubleshooting

### Permission Not Working

1. **Check Role Resolution**: Verify user's Profile/Permission Set matches Custom Metadata mapping
2. **Check Permission Matrix**: Verify `Permissions__c` field includes required permission
3. **Check Field Security**: Verify `Viewable_Fields__c` includes field name (if using whitelist)
4. **Check Cache**: Clear cache by restarting Apex transaction or deploying new Custom Metadata

### Fields Still Visible

1. **Check Viewable_Fields__c**: If empty, all fields are allowed (except sensitive ones)
2. **Check Field Name**: Ensure field name in `Viewable_Fields__c` matches exactly (case-insensitive)
3. **Check Entity Match**: Ensure `Entity__c` matches the entity being queried

### Default Permissions Not Working

1. **Check Custom Metadata**: Even one Custom Metadata record disables defaults
2. **Remove Custom Metadata**: Delete all Custom Metadata records to use defaults
3. **Complete Configuration**: Ensure all roles/entities are configured in Custom Metadata

## Migration Guide

### From Hardcoded to Custom Metadata

1. **Export Current Config**: Document current hardcoded permissions
2. **Create Custom Metadata Records**: Replicate permissions in Custom Metadata
3. **Test**: Verify permissions work as expected
4. **Deploy**: Deploy Custom Metadata to production
5. **Monitor**: Watch for any permission issues

### Adding New Roles

1. **Define Role**: Choose role identifier (e.g., `FINANCE_USER`)
2. **Map to Profile/Permission Set**: Create mapping record
3. **Define Permissions**: Create permission records for each entity
4. **Define Field Security**: Create field permission records if needed
5. **Test**: Assign role to test user and verify

