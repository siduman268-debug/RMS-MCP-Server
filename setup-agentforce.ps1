# Agent Force MCP Server Setup Script for Windows
# This script helps set up Agent Force to connect to the RMS MCP Server

Write-Host "🚀 Agent Force MCP Server Setup" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if Agent Force configuration directory exists
$agentForceConfigPath = Join-Path $env:APPDATA "Salesforce\AgentForce"
$configFile = Join-Path $agentForceConfigPath "mcp-servers.json"

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
$mcpConfigPath = Join-Path $PSScriptRoot "agentforce-mcp-config.json"
if (-not (Test-Path $mcpConfigPath)) {
    Write-Host "❌ Error: agentforce-mcp-config.json not found in current directory" -ForegroundColor Red
    Write-Host "   Current directory: $PSScriptRoot" -ForegroundColor Red
    exit 1
}

$mcpConfig = Get-Content $mcpConfigPath | ConvertFrom-Json
Write-Host "✅ MCP configuration loaded from: $mcpConfigPath" -ForegroundColor Green
Write-Host ""

# Check if config file already exists
if (Test-Path $configFile) {
    Write-Host "⚠️  Configuration file already exists" -ForegroundColor Yellow
    $backupPath = "$configFile.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $configFile $backupPath -Force
    Write-Host "   Backup created: $backupPath" -ForegroundColor Yellow
    
    $existingConfig = Get-Content $configFile | ConvertFrom-Json
    
    # Check if rms-supabase-server already exists
    if ($existingConfig.mcpServers.'rms-supabase-server') {
        Write-Host "   ⚠️  rms-supabase-server already configured" -ForegroundColor Yellow
        $overwrite = Read-Host "   Overwrite existing configuration? (y/n)"
        if ($overwrite -ne 'y' -and $overwrite -ne 'Y') {
            Write-Host "   ℹ️  Keeping existing configuration" -ForegroundColor Cyan
            exit 0
        }
        
        # Merge configurations
        $existingConfig.mcpServers.'rms-supabase-server' = $mcpConfig.mcpServers.'rms-supabase-server'
        $configToWrite = $existingConfig
    } else {
        # Add to existing config
        $existingConfig.mcpServers | Add-Member -MemberType NoteProperty -Name 'rms-supabase-server' -Value $mcpConfig.mcpServers.'rms-supabase-server' -Force
        $configToWrite = $existingConfig
    }
} else {
    # Create new config
    $configToWrite = $mcpConfig
}

# Verify the server path exists
$serverPath = $mcpConfig.mcpServers.'rms-supabase-server'.args[0]
if (-not (Test-Path $serverPath)) {
    Write-Host "⚠️  Warning: Server path not found: $serverPath" -ForegroundColor Yellow
    Write-Host "   The path will be set, but ensure the server is built before using Agent Force" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   To build the server:" -ForegroundColor Cyan
    Write-Host "      cd $(Split-Path $serverPath -Parent)" -ForegroundColor Cyan
    Write-Host "      npm run build" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ Server path verified: $serverPath" -ForegroundColor Green
}

# Verify Node.js is available
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Warning: Node.js not found in PATH" -ForegroundColor Yellow
        Write-Host "   Agent Force will need Node.js to run the MCP server" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Warning: Could not verify Node.js installation" -ForegroundColor Yellow
}

Write-Host ""

# Write configuration
Write-Host "💾 Writing configuration to Agent Force..." -ForegroundColor Yellow
$configToWrite | ConvertTo-Json -Depth 10 | Set-Content $configFile -Encoding UTF8
Write-Host "✅ Configuration saved to: $configFile" -ForegroundColor Green
Write-Host ""

# Display configuration summary
Write-Host "📊 Configuration Summary:" -ForegroundColor Cyan
Write-Host "   MCP Server: rms-supabase-server" -ForegroundColor White
Write-Host "   Command: $($mcpConfig.mcpServers.'rms-supabase-server'.command)" -ForegroundColor White
Write-Host "   Server Path: $serverPath" -ForegroundColor White
Write-Host "   Supabase URL: $($mcpConfig.mcpServers.'rms-supabase-server'.env.SUPABASE_URL)" -ForegroundColor White
Write-Host ""

# Display next steps
Write-Host "✅ Agent Force MCP Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Restart Agent Force if it's running" -ForegroundColor White
Write-Host "   2. Verify connection in Agent Force interface" -ForegroundColor White
Write-Host "   3. Test with: What MCP tools are available?" -ForegroundColor White
Write-Host "   4. Try: Search for vessel schedules from INNSA to NLRTM" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   See AGENTFORCE_MCP_SETUP.md for detailed instructions" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Available Tools:" -ForegroundColor Yellow
Write-Host "   - 26 total MCP tools" -ForegroundColor White
Write-Host "   - 6 new schedule tools" -ForegroundColor White
Write-Host "   - See AGENTFORCE_MCP_SETUP.md for complete list" -ForegroundColor White
Write-Host ""

