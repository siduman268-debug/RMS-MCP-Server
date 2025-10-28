# RMS Salesforce Flow Deployment Script (PowerShell)
# This script deploys the RMS Flow frontend components to Salesforce

Write-Host "🚀 Starting RMS Salesforce Flow Deployment..." -ForegroundColor Green

# Check if Salesforce CLI is installed
try {
    $null = Get-Command sf -ErrorAction Stop
    Write-Host "✅ Salesforce CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Salesforce CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "   Run: npm install -g @salesforce/cli" -ForegroundColor Yellow
    exit 1
}

# Check if we're authenticated
Write-Host "🔐 Checking Salesforce authentication..." -ForegroundColor Blue
try {
    $null = sf org list 2>$null
    Write-Host "✅ Authenticated to Salesforce" -ForegroundColor Green
} catch {
    Write-Host "❌ Not authenticated to Salesforce. Please login first." -ForegroundColor Red
    Write-Host "   Run: sf org login web" -ForegroundColor Yellow
    exit 1
}

# Set target org (update this to your org alias)
$TARGET_ORG = "RMS-Scratch-Org"

Write-Host "📦 Deploying RMS Flow Components..." -ForegroundColor Blue

# Deploy Apex Classes
Write-Host "   📄 Deploying Apex Classes..." -ForegroundColor Cyan
$result = sf project deploy start --source-dir force-app/main/default/classes --target-org $TARGET_ORG

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Apex Classes deployed successfully" -ForegroundColor Green
} else {
    Write-Host "   ❌ Apex Classes deployment failed" -ForegroundColor Red
    exit 1
}

# Deploy Flows
Write-Host "   🌊 Deploying Flows..." -ForegroundColor Cyan
$result = sf project deploy start --source-dir force-app/main/default/flows --target-org $TARGET_ORG

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Flows deployed successfully" -ForegroundColor Green
} else {
    Write-Host "   ❌ Flows deployment failed" -ForegroundColor Red
    exit 1
}

# Deploy Named Credentials
Write-Host "   🔑 Deploying Named Credentials..." -ForegroundColor Cyan
$result = sf project deploy start --source-dir force-app/main/default/namedCredentials --target-org $TARGET_ORG

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Named Credentials deployed successfully" -ForegroundColor Green
} else {
    Write-Host "   ❌ Named Credentials deployment failed" -ForegroundColor Red
    exit 1
}

# Run tests (optional)
Write-Host "🧪 Running tests..." -ForegroundColor Blue
sf apex run test --target-org $TARGET_ORG --result-format human

Write-Host ""
Write-Host "🎉 RMS Salesforce Flow Frontend Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Activate the Flows in Setup → Flows" -ForegroundColor White
Write-Host "   2. Test the Flows with sample data" -ForegroundColor White
Write-Host "   3. Create custom buttons or app launcher entries" -ForegroundColor White
Write-Host "   4. Train users on Flow usage" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   - Flow Guide: SALESFORCE_FLOW_GUIDE.md" -ForegroundColor White
Write-Host "   - API Documentation: API_DOCUMENTATION.md" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
Write-Host "   - Check debug logs if Flows fail" -ForegroundColor White
Write-Host "   - Verify Named Credential configuration" -ForegroundColor White
Write-Host "   - Ensure custom objects are deployed" -ForegroundColor White
Write-Host ""