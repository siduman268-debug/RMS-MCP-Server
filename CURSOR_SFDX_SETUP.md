# Cursor + Salesforce CLI Setup Guide

## Why Cursor is Great for Salesforce Development

✅ **AI-Powered** - Built-in AI assistance for coding
✅ **VS Code Compatible** - Uses VS Code extensions
✅ **Better Performance** - Faster than VS Code
✅ **Modern Interface** - Clean, intuitive design
✅ **Salesforce Support** - Works with all Salesforce extensions

## Step 1: Install Salesforce CLI

### Download and Install
1. **Go to**: https://developer.salesforce.com/tools/sfdxcli
2. **Download** the Windows installer
3. **Run the installer** and follow the setup wizard
4. **Restart** your command prompt/PowerShell

### Verify Installation
```bash
# Check if Salesforce CLI is installed
sfdx --version

# Should show something like:
# sfdx-cli/7.200.0 win32-x64 node-v18.17.0
```

## Step 2: Install Cursor

### Download Cursor
1. **Go to**: https://cursor.sh/
2. **Download** the Windows installer
3. **Run the installer** and follow the setup wizard

## Step 3: Install Salesforce Extensions in Cursor

### Install Extensions
1. **Open Cursor**
2. **Click Extensions** (Ctrl+Shift+X)
3. **Search for**: `Salesforce Extension Pack`
4. **Install** the official Salesforce Extension Pack by Salesforce

### Required Extensions:
- ✅ **Salesforce Extension Pack (Official)**
- ✅ **Apex** - For Apex code development
- ✅ **Lightning Web Components** - For LWC development
- ✅ **Salesforce CLI Integration** - For deployment
- ✅ **Salesforce Snippets** - Code snippets

## Step 4: Open Your RMS Project in Cursor

### Open Project
1. **Open Cursor**
2. **File** → **Open Folder**
3. **Navigate to**: `C:\Users\Admin\RMS\rms-mcp-server`
4. **Select** the `rms-mcp-server` folder

### Verify Project Structure
You should see:
```
rms-mcp-server/
├── force-app/
│   └── main/
│       └── default/
│           ├── objects/
│           │   ├── Ocean_Freight_Rate__c/
│           │   ├── Margin_Rule__c/
│           │   ├── Surcharge__c/
│           │   └── RMS_Flow_Setting__c/
│           ├── classes/
│           │   ├── RMSApiUtil.cls
│           │   ├── OceanFreightRateService.cls
│           │   ├── MarginRuleService.cls
│           │   └── SurchargeService.cls
│           ├── namedCredentials/
│           └── lwc/
├── src/
├── package.json
└── sfdx-project.json
```

## Step 5: Authorize Your Salesforce Org

### Method 1: Using Cursor
1. **Press**: `Ctrl+Shift+P`
2. **Type**: `SFDX: Authorize an Org`
3. **Select**: `SFDX: Authorize an Org`
4. **Choose**: `Production` or `Sandbox`
5. **Enter** your Salesforce credentials
6. **Give it a name**: `RMS-Dev-Org`

### Method 2: Using Command Line
```bash
# Authorize production org
sfdx auth:web:login -d -a RMS-Dev-Org

# Authorize sandbox org
sfdx auth:web:login -d -a RMS-Sandbox -r https://test.salesforce.com
```

## Step 6: Set Default Org

### Set Default Org
```bash
# Set your authorized org as default
sfdx config:set defaultusername=RMS-Dev-Org
```

## Step 7: Deploy Your Custom Objects

### Deploy All Objects
```bash
# Deploy all custom objects
sfdx force:source:deploy -p force-app/main/default/objects
```

### Deploy Individual Objects
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

## Step 8: Cursor-Specific Features

### AI-Powered Development
- **Ctrl+K** - AI chat for coding assistance
- **Ctrl+L** - AI code completion
- **Ctrl+I** - AI inline editing

### Salesforce-Specific AI Prompts
```
"Create a Salesforce Flow for managing ocean freight rates"
"Generate Apex code for API integration"
"Create Lightning Web Component for data table"
"Write SOQL queries for custom objects"
```

### Available Commands (Ctrl+Shift+P)
- `SFDX: Authorize an Org`
- `SFDX: Deploy Source to Org`
- `SFDX: Retrieve Source from Org`
- `SFDX: Create Project`
- `SFDX: Open Default Org`
- `SFDX: Refresh SObject Definitions`

## Step 9: Verify Setup

### Test Commands
```bash
# Check Salesforce CLI
sfdx --version

# Check authorized orgs
sfdx auth:list

# Check default org
sfdx config:get defaultusername

# Test org connection
sfdx force:org:display
```

### Test Cursor Integration
1. **Right-click** on `force-app` folder
2. **Select**: `SFDX: Deploy Source to Org`
3. **Check** deployment status in Cursor terminal

## Step 10: AI-Assisted Development

### Use AI for Salesforce Development
1. **Select** your Apex class or LWC component
2. **Press** `Ctrl+K` to open AI chat
3. **Ask** questions like:
   - "How do I create a Salesforce Flow?"
   - "Generate Apex code for API calls"
   - "Create a Lightning Web Component"
   - "Write SOQL queries"

### Example AI Prompts
```
"Create a Salesforce Flow that allows users to search ocean freight rates by POL and POD codes"

"Generate Apex code to call the RMS API and retrieve margin rules"

"Create a Lightning Web Component that displays ocean freight rates in a table format"

"Write SOQL queries to retrieve active surcharges for a specific vendor"
```

## Troubleshooting

### Common Issues:

#### 1. Salesforce CLI Not Found
```bash
# Add to PATH manually
# Add: C:\Program Files\Salesforce CLI\bin
# To your system PATH environment variable
```

#### 2. Cursor Extensions Not Working
- **Restart Cursor** after installing extensions
- **Check** if extensions are enabled
- **Update** to latest version

#### 3. Authentication Issues
```bash
# Clear auth cache
sfdx auth:logout --all

# Re-authorize
sfdx auth:web:login -d -a RMS-Dev-Org
```

## Next Steps

### After Setup:
1. **Deploy Custom Objects** to your org
2. **Create Custom Tabs** for your objects
3. **Set up Page Layouts**
4. **Create Flows** using AI assistance
5. **Build Custom Components** with AI help

### AI-Powered Development:
- **Use Ctrl+K** for AI chat assistance
- **Ask specific questions** about Salesforce development
- **Generate code** with AI help
- **Debug issues** using AI

## Ready to Go!

Once setup is complete, you can:
- ✅ **Deploy** your custom objects
- ✅ **Develop** with AI assistance
- ✅ **Create** Flows and components
- ✅ **Manage** your Salesforce org from Cursor

Cursor + Salesforce CLI + AI = Powerful development environment! 🚀

