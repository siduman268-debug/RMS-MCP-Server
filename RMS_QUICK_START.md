# RMS Management LWC - Quick Start Guide

## TL;DR - Deploy in 5 Minutes

### 1. Deploy Everything

```bash
# Deploy all Apex classes
sf project deploy start --source-dir force-app/main/default/classes

# Deploy Custom Metadata Type
sf project deploy start --source-dir force-app/main/default/objects/RMS_Role_Permission__mdt

# Deploy sample Custom Metadata records (optional)
sf project deploy start --source-dir force-app/main/default/customMetadata

# Deploy LWC components
sf project deploy start --source-dir force-app/main/default/lwc
```

### 2. Configure Named Credential

1. Setup → Named Credentials → `RMS_API`
2. Configure your API endpoint and authentication

### 3. Update Tenant ID (if multi-tenant)

Edit `RMSApiUtil.getTenantId()` based on your tenant model (see `RMS_TENANT_RLS_IMPLEMENTATION.md`)

### 4. Configure RBAC (optional - defaults will work)

Option A: Update sample Custom Metadata records to match your Profiles/Permission Sets
Option B: Use defaults (works out of the box)

### 5. Create App Page

1. Lightning App Builder → New → App Page
2. Add `rmsManagement` component
3. Activate and test!

## What Works Out of the Box

✅ **Default Permissions**: System works with hardcoded defaults if no Custom Metadata configured
✅ **Default Roles**: Maps to standard Profile names (e.g., "System Administrator" → ADMIN)
✅ **Tenant Isolation**: Uses default tenant ID if not configured
✅ **Field Security**: Hides sensitive fields by default (buy_amount, sell_amount, margin)

## Customization Needed

🔧 **Tenant ID Resolution**: Update `RMSApiUtil.getTenantId()` if multi-tenant
🔧 **Role Mappings**: Update Custom Metadata if your Profiles/Permission Sets differ
🔧 **Permissions**: Customize Custom Metadata if default permissions don't fit your needs

## Testing

1. Log in as different users (Pricing, Sales, etc.)
2. Access RMS Management App Page
3. Verify:
   - Users see appropriate tabs/entities
   - Users can only perform allowed actions
   - Sensitive fields are hidden
   - Tenant data is isolated

## Getting Help

- **Full Deployment Guide**: See `RMS_DEPLOYMENT_CHECKLIST.md`
- **RBAC Configuration**: See `RMS_CONFIGURABLE_RBAC_GUIDE.md`
- **Tenant Isolation**: See `RMS_TENANT_RLS_IMPLEMENTATION.md`

