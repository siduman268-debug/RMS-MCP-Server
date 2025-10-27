# VS Code + Salesforce CLI Setup Guide

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

## Step 2: Install VS Code

### Download VS Code
1. **Go to**: https://code.visualstudio.com/
2. **Download** the Windows installer
3. **Run the installer** and follow the setup wizard

## Step 3: Install Salesforce Extension Pack

### Install Extensions
1. **Open VS Code**
2. **Click Extensions** (Ctrl+Shift+X)
3. **Search for**: `Salesforce Extension Pack`
4. **Install** the official Salesforce Extension Pack by Salesforce

### Required Extensions:
- ✅ **Salesforce Extension Pack (Official)**
- ✅ **Apex** - For Apex code development
- ✅ **Lightning Web Components** - For LWC development
- ✅ **Salesforce CLI Integration** - For deployment
- ✅ **Salesforce Snippets** - Code snippets

## Step 4: Configure VS Code for Salesforce

### Open Your Project
1. **Open VS Code**
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
│           ├── classes/
│           ├── namedCredentials/
│           └── lwc/
├── src/
├── package.json
└── sfdx-project.json
```

## Step 5: Create sfdx-project.json

### Create Project Configuration
```json
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true,
      "package": "RMS-Integration",
      "versionName": "ver 1.0",
      "versionNumber": "1.0.0.NEXT"
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "60.0",
  "packageAliases": {}
}
```

## Step 6: Authorize Your Salesforce Org

### Method 1: Using VS Code
1. **Press**: `Ctrl+Shift+P`
2. **Type**: `SFDX: Authorize an Org`
3. **Select**: `SFDX: Authorize an Org`
4. **Choose**: `Production` or `Sandbox`
5. **Enter** your Salesforce credentials
6. **Give it a name**: `RMS-Dev-Org` (or whatever you prefer)

### Method 2: Using Command Line
```bash
# Authorize production org
sfdx auth:web:login -d -a RMS-Dev-Org

# Authorize sandbox org
sfdx auth:web:login -d -a RMS-Sandbox -r https://test.salesforce.com
```

## Step 7: Set Default Org

### Set Default Org
```bash
# Set your authorized org as default
sfdx config:set defaultusername=RMS-Dev-Org
```

### Verify Default Org
```bash
# Check current default org
sfdx config:get defaultusername
```

## Step 8: Test Deployment

### Deploy Custom Objects
```bash
# Deploy all custom objects
sfdx force:source:deploy -p force-app/main/default/objects

# Or deploy specific object
sfdx force:source:deploy -p force-app/main/default/objects/Ocean_Freight_Rate__c
```

### Check Deployment Status
```bash
# Check deployment status
sfdx force:source:deploy:report
```

## Step 9: VS Code Salesforce Features

### Available Commands (Ctrl+Shift+P)
- `SFDX: Authorize an Org`
- `SFDX: Deploy Source to Org`
- `SFDX: Retrieve Source from Org`
- `SFDX: Create Project`
- `SFDX: Open Default Org`
- `SFDX: Refresh SObject Definitions`

### Right-Click Context Menu
- **Deploy Source to Org**
- **Retrieve Source from Org**
- **Open in Default Org**
- **Refresh SObject Definitions**

## Step 10: Verify Setup

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

### Test VS Code Integration
1. **Right-click** on `force-app` folder
2. **Select**: `SFDX: Deploy Source to Org`
3. **Check** deployment status in VS Code terminal

## Troubleshooting

### Common Issues:

#### 1. Salesforce CLI Not Found
```bash
# Add to PATH manually
# Add: C:\Program Files\Salesforce CLI\bin
# To your system PATH environment variable
```

#### 2. VS Code Extensions Not Working
- **Restart VS Code** after installing extensions
- **Check** if extensions are enabled
- **Update** to latest version

#### 3. Authentication Issues
```bash
# Clear auth cache
sfdx auth:logout --all

# Re-authorize
sfdx auth:web:login -d -a RMS-Dev-Org
```

#### 4. Deployment Errors
```bash
# Check deployment logs
sfdx force:source:deploy:report -i [deployment-id] --verbose

# Validate before deploy
sfdx force:source:deploy -p force-app/main/default/objects --checkonly
```

## Next Steps

### After Setup:
1. **Deploy Custom Objects** to your org
2. **Create Custom Tabs** for your objects
3. **Set up Page Layouts**
4. **Create Flows** using the objects
5. **Build Custom Components**

### Useful Commands:
```bash
# Deploy everything
sfdx force:source:deploy -p force-app/main/default

# Retrieve from org
sfdx force:source:retrieve -p force-app/main/default

# Open org in browser
sfdx force:org:open

# Create new Apex class
sfdx force:apex:class:create -n MyClass

# Create new LWC
sfdx force:lightning:component:create -n myComponent
```

## Ready to Go!

Once setup is complete, you can:
- ✅ **Deploy** your custom objects
- ✅ **Develop** Apex classes and LWC components
- ✅ **Create** Flows and Process Builder
- ✅ **Manage** your Salesforce org from VS Code

Let me know when you've completed the setup and I'll help you deploy your custom objects!
