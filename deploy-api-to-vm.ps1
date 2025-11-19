# ==================================================================
# DEPLOYMENT SCRIPT: Deploy API Changes to VM
# Purpose: Build, transfer, and restart API on VM
# Date: 2025-11-19
# ==================================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API Deployment to VM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# VM Details
$VM_IP = "20.163.195.191"
$VM_USER = "azureuser"
$VM_PATH = "/home/azureuser/rms-mcp-server"

Write-Host "📦 Building dist folder..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed!" -ForegroundColor Green
Write-Host ""

Write-Host "📤 Transferring dist folder to VM..." -ForegroundColor Yellow
scp -r dist ${VM_USER}@${VM_IP}:${VM_PATH}/

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Transfer failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Transfer completed!" -ForegroundColor Green
Write-Host ""

Write-Host "🔄 Restarting Docker container on VM..." -ForegroundColor Yellow
ssh ${VM_USER}@${VM_IP} "cd ${VM_PATH} && docker-compose restart rms-api"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Restart failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker container restarted!" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check logs with:" -ForegroundColor Yellow
Write-Host "ssh ${VM_USER}@${VM_IP} 'cd ${VM_PATH} && docker-compose logs -f --tail=50 rms-api'" -ForegroundColor White
Write-Host ""

