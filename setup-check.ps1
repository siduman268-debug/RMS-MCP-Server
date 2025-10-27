# Quick Setup Script for VS Code + Salesforce CLI

Write-Host "🚀 Setting up VS Code + Salesforce CLI for RMS Project" -ForegroundColor Cyan

# Check if Salesforce CLI is installed
Write-Host "`n📋 Checking Salesforce CLI installation..." -ForegroundColor Yellow
try {
    $sfdxVersion = sfdx --version
    Write-Host "✅ Salesforce CLI found: $sfdxVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Salesforce CLI not found. Please install from:" -ForegroundColor Red
    Write-Host "   https://developer.salesforce.com/tools/sfdxcli" -ForegroundColor Yellow
    Write-Host "`nAfter installation, restart PowerShell and run this script again." -ForegroundColor Yellow
    exit 1
}

# Check if VS Code is installed
Write-Host "`n📋 Checking VS Code installation..." -ForegroundColor Yellow
try {
    $vscodeVersion = code --version
    Write-Host "✅ VS Code found: $($vscodeVersion[0])" -ForegroundColor Green
} catch {
    Write-Host "❌ VS Code not found. Please install from:" -ForegroundColor Red
    Write-Host "   https://code.visualstudio.com/" -ForegroundColor Yellow
    Write-Host "`nAfter installation, restart PowerShell and run this script again." -ForegroundColor Yellow
    exit 1
}

# Check if sfdx-project.json exists
Write-Host "`n📋 Checking project configuration..." -ForegroundColor Yellow
if (Test-Path "sfdx-project.json") {
    Write-Host "✅ sfdx-project.json found" -ForegroundColor Green
} else {
    Write-Host "❌ sfdx-project.json not found. Creating..." -ForegroundColor Red
    # The file should already be created by the previous step
}

# Check if force-app directory exists
Write-Host "`n📋 Checking Salesforce project structure..." -ForegroundColor Yellow
if (Test-Path "force-app") {
    Write-Host "✅ force-app directory found" -ForegroundColor Green
} else {
    Write-Host "❌ force-app directory not found" -ForegroundColor Red
    exit 1
}

# List custom objects
Write-Host "`n📋 Checking custom objects..." -ForegroundColor Yellow
$objects = Get-ChildItem -Path "force-app/main/default/objects" -Directory
if ($objects.Count -gt 0) {
    Write-Host "✅ Found $($objects.Count) custom objects:" -ForegroundColor Green
    foreach ($obj in $objects) {
        Write-Host "   - $($obj.Name)" -ForegroundColor White
    }
} else {
    Write-Host "❌ No custom objects found" -ForegroundColor Red
}

# List Apex classes
Write-Host "`n📋 Checking Apex classes..." -ForegroundColor Yellow
if (Test-Path "force-app/main/default/classes") {
    $classes = Get-ChildItem -Path "force-app/main/default/classes" -Filter "*.cls"
    if ($classes.Count -gt 0) {
        Write-Host "✅ Found $($classes.Count) Apex classes:" -ForegroundColor Green
        foreach ($cls in $classes) {
            Write-Host "   - $($cls.BaseName)" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  No Apex classes found" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ classes directory not found" -ForegroundColor Red
}

Write-Host "`n🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Open VS Code in this directory:" -ForegroundColor White
Write-Host "   code ." -ForegroundColor Yellow
Write-Host "`n2. Install Salesforce Extension Pack in VS Code:" -ForegroundColor White
Write-Host "   - Press Ctrl+Shift+X" -ForegroundColor Yellow
Write-Host "   - Search for 'Salesforce Extension Pack'" -ForegroundColor Yellow
Write-Host "   - Install the official one by Salesforce" -ForegroundColor Yellow
Write-Host "`n3. Authorize your Salesforce org:" -ForegroundColor White
Write-Host "   - Press Ctrl+Shift+P in VS Code" -ForegroundColor Yellow
Write-Host "   - Type 'SFDX: Authorize an Org'" -ForegroundColor Yellow
Write-Host "   - Follow the prompts" -ForegroundColor Yellow
Write-Host "`n4. Deploy your custom objects:" -ForegroundColor White
Write-Host "   sfdx force:source:deploy -p force-app/main/default/objects" -ForegroundColor Yellow
Write-Host "`n5. Verify in Salesforce:" -ForegroundColor White
Write-Host "   - Go to Setup → Object Manager" -ForegroundColor Yellow
Write-Host "   - Look for your custom objects" -ForegroundColor Yellow

Write-Host "`n✅ Setup check complete!" -ForegroundColor Green
Write-Host "Ready to start developing your RMS Salesforce frontend! 🚀" -ForegroundColor Cyan
