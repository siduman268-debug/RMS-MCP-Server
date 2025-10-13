# RMS MCP Server - Windows Firewall Setup
# Run this script as Administrator

Write-Host "🔥 RMS MCP Server - Firewall Configuration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green
Write-Host ""

# Get current IP address
Write-Host "📡 Your Network Information:" -ForegroundColor Cyan
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"} | Select-Object -First 1).IPAddress
Write-Host "   IP Address: $ipAddress" -ForegroundColor Green
Write-Host ""

# Add firewall rule for port 3000
Write-Host "🛡️  Configuring Windows Firewall..." -ForegroundColor Cyan

# Check if rule already exists
$existingRule = Get-NetFirewallRule -DisplayName "RMS API Server" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "   Firewall rule already exists. Removing old rule..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "RMS API Server"
}

# Create new firewall rule
New-NetFirewallRule -DisplayName "RMS API Server" `
    -Direction Inbound `
    -LocalPort 3000 `
    -Protocol TCP `
    -Action Allow `
    -Profile Any `
    -Description "Allow incoming connections to RMS MCP Server API on port 3000" | Out-Null

Write-Host "✅ Firewall rule created for port 3000" -ForegroundColor Green
Write-Host ""

# Test if server is running
Write-Host "🔍 Testing RMS Server..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -ErrorAction Stop
    Write-Host "✅ Server is running!" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Green
    Write-Host "   Service: $($response.service)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Server not responding on port 3000" -ForegroundColor Yellow
    Write-Host "   Make sure the server is running:" -ForegroundColor Yellow
    Write-Host "   cd C:\Users\Admin\RMS\rms-mcp-server" -ForegroundColor Gray
    Write-Host '   $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_KEY="..."; node dist/index.js' -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Start RMS Server (if not already running)" -ForegroundColor White
Write-Host "   2. From your VM, test connection:" -ForegroundColor White
Write-Host "      curl http://${ipAddress}:3000/health" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. In n8n workflows, use this URL:" -ForegroundColor White
Write-Host "      http://${ipAddress}:3000/api/..." -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tip: To allow Remote Desktop connections, run:" -ForegroundColor Yellow
Write-Host "   Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name 'fDenyTSConnections' -Value 0" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"

