# Salesforce Custom Objects Deployment Script

## Prerequisites
1. Install Salesforce CLI: https://developer.salesforce.com/tools/sfdxcli
2. Install VS Code with Salesforce Extension Pack
3. Authorize your Salesforce org

## Deployment Commands

### Option 1: Deploy All Objects at Once
```bash
# Navigate to your project directory
cd C:\Users\Admin\RMS\rms-mcp-server

# Deploy all custom objects
sfdx force:source:deploy -p force-app/main/default/objects
```

### Option 2: Deploy Objects Individually
```bash
# Deploy Ocean Freight Rate object
sfdx force:source:deploy -p force-app/main/default/objects/Ocean_Freight_Rate__c

# Deploy Margin Rule object
sfdx force:source:deploy -p force-app/main/default/objects/Margin_Rule__c

# Deploy Surcharge object
sfdx force:source:deploy -p force-app/main/default/objects/Surcharge__c

# Deploy RMS Flow Setting object
sfdx force:source:deploy -p force-app/main/default/objects/RMS_Flow_Setting__c
```

### Option 3: Deploy Everything (Objects + Classes + Named Credentials)
```bash
# Deploy entire force-app directory
sfdx force:source:deploy -p force-app/main/default
```

## Verification Steps

### 1. Check Object Manager
- Go to **Setup** → **Object Manager**
- Look for your custom objects:
  - Ocean Freight Rate
  - Margin Rule
  - Surcharge
  - RMS Flow Setting

### 2. Check App Launcher
- Click **App Launcher** (9 dots)
- Look for your custom objects in the list

### 3. Test Object Creation
- Try creating a new record for each object
- Verify all fields are present
- Check picklist values

## Troubleshooting

### Common Issues:
1. **Permission Errors**: Make sure you're logged in as System Administrator
2. **Validation Errors**: Check field names and data types
3. **Deployment Failures**: Check the deployment logs for specific errors

### Check Deployment Status:
```bash
# Check deployment status
sfdx force:source:deploy:report

# Get detailed logs
sfdx force:source:deploy:report -i [deployment-id] --verbose
```

## Next Steps After Deployment

1. **Create Tabs** for your custom objects
2. **Set up Page Layouts** for better user experience
3. **Configure Security** and sharing rules
4. **Create Custom Apps** to organize your objects
5. **Set up Flows** using these objects

## Custom Object Summary

### Ocean_Freight_Rate__c
- **Purpose**: Store ocean freight shipping rates
- **Key Fields**: POL Code, POD Code, Container Type, Buy Amount, Currency
- **Features**: Auto-numbered names, search layouts, validation rules

### Margin_Rule__c
- **Purpose**: Define margin calculation rules
- **Key Fields**: Level, Mark Kind, Mark Value, Priority
- **Features**: Picklist values for Level and Mark Kind

### Surcharge__c
- **Purpose**: Store additional charges for shipments
- **Key Fields**: Charge Code, Amount, UOM, Applies Scope
- **Features**: Multiple picklist values, validation rules

### RMS_Flow_Setting__c
- **Purpose**: Store configuration settings for flows
- **Key Fields**: Setting Name, Setting Value, Environment, Category
- **Features**: Environment-specific settings, categorization

## Ready to Deploy?

Run this command to deploy all objects:
```bash
sfdx force:source:deploy -p force-app/main/default/objects
```

Then verify in your Salesforce org that the objects were created successfully!
