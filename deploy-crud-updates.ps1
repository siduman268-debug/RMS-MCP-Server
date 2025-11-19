# ==================================================================
# DEPLOYMENT SCRIPT: CRUD Functionality Updates
# Purpose: Deploy updated LWC components and Apex classes for CRUD operations
# Date: 2025-11-19
# ==================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RMS CRUD Updates Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Deploy LWC components
Write-Host "Deploying LWC components..." -ForegroundColor Yellow
sf project deploy start `
    --source-dir force-app/main/default/lwc/rmsSchemaConstants `
    --source-dir force-app/main/default/lwc/rmsModalForm `
    --wait 10

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ LWC deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ LWC components deployed successfully!" -ForegroundColor Green
Write-Host ""

# Deploy Apex classes
Write-Host "Deploying Apex classes..." -ForegroundColor Yellow
sf project deploy start `
    --source-dir force-app/main/default/classes/RMSVendorService.cls `
    --source-dir force-app/main/default/classes/RMSVendorService.cls-meta.xml `
    --wait 10

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Apex deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Apex classes deployed successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open Salesforce and navigate to RMS Management app" -ForegroundColor White
Write-Host "2. Go to Vendors tab" -ForegroundColor White
Write-Host "3. Test Create, Edit, and Delete operations" -ForegroundColor White
Write-Host "4. Verify form fields display correctly (including multiselect for Mode)" -ForegroundColor White
Write-Host ""

