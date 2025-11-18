# Agent Force MCP Server Setup Script for Windows (Simplified)
# This script helps set up Agent Force to connect to the RMS MCP Server

Write-Host "🚀 Agent Force MCP Server Setup" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Configuration paths
$agentForceConfigPath = Join-Path $env:APPDATA "Salesforce\AgentForce"
$configFile = Join-Path $agentForceConfigPath "mcp-servers.json"
$mcpConfigPath = Join-Path $PSScriptRoot "agentforce-mcp-config.json"

Write-Host "📋 Configuration Details:" -ForegroundColor Yellow
Write-Host "   Agent Force Config Directory: $agentForceConfigPath"
Write-Host "   Config File: $configFile"
Write-Host ""

# Create directory if it doesn't exist
if (-not (Test-Path $agentForceConfigPath)) {
    Write-Host "📁 Creating Agent Force configuration directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $agentForceConfigPath -Force | Out-Null
    Write-Host "✅ Directory created" -ForegroundColor Green
} else {
    Write-Host "✅ Configuration directory exists" -ForegroundColor Green
}

# Read the MCP server config
if (-not (Test-Path $mcpConfigPath)) {
    Write-Host "❌ Error: agentforce-mcp-config.json not found" -ForegroundColor Red
    exit 1
}

$mcpConfig = Get-Content $mcpConfigPath | ConvertFrom-Json
Write-Host "✅ MCP configuration loaded" -ForegroundColor Green
Write-Host ""

# Backup existing config if it exists
if (Test-Path $configFile) {
    Write-Host "⚠️  Configuration file already exists" -ForegroundColor Yellow
    $backupPath = "$configFile.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $configFile $backupPath -Force
    Write-Host "   Backup created: $backupPath" -ForegroundColor Yellow
    $existingConfig = Get-Content $configFile | ConvertFrom-Json
    $existingConfig.mcpServers.'rms-supabase-server' = $mcpConfig.mcpServers.'rms-supabase-server'
    $configToWrite = $existingConfig
} else {
    $configToWrite = $mcpConfig
}

# Verify server path
$serverPath = $mcpConfig.mcpServers.'rms-supabase-server'.args[0]
if (Test-Path $serverPath) {
    Write-Host "✅ Server path verified: $serverPath" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: Server path not found: $serverPath" -ForegroundColor Yellow
    Write-Host "   Please ensure the server is built before using Agent Force" -ForegroundColor Yellow
}

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Warning: Node.js not found" -ForegroundColor Yellow
}

Write-Host ""

# Write configuration
Write-Host "💾 Writing configuration..." -ForegroundColor Yellow
$configToWrite | ConvertTo-Json -Depth 10 | Set-Content $configFile -Encoding UTF8
Write-Host "✅ Configuration saved to: $configFile" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "📊 Configuration Summary:" -ForegroundColor Cyan
Write-Host "   MCP Server: rms-supabase-server" -ForegroundColor White
Write-Host "   Command: $($mcpConfig.mcpServers.'rms-supabase-server'.command)" -ForegroundColor White
Write-Host "   Server Path: $serverPath" -ForegroundColor White
Write-Host ""

Write-Host "✅ Agent Force MCP Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Restart Agent Force if it's running" -ForegroundColor White
Write-Host "   2. Verify connection in Agent Force interface" -ForegroundColor White
Write-Host "   3. Test with: What MCP tools are available?" -ForegroundColor White
Write-Host ""
Write-Host "📚 See AGENTFORCE_MCP_SETUP.md for detailed instructions" -ForegroundColor Yellow
Write-Host ""

