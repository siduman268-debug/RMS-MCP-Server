# PowerShell script to set up Claude Desktop with RMS MCP Server

Write-Host "🚀 Setting up Claude Desktop with RMS MCP Server..." -ForegroundColor Green

# Get the current directory
$currentDir = Get-Location
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$mcpServerPath = "$currentDir\dist\index.js"

Write-Host "📁 Current directory: $currentDir" -ForegroundColor Yellow
Write-Host "📁 MCP Server path: $mcpServerPath" -ForegroundColor Yellow
Write-Host "📁 Claude config path: $configPath" -ForegroundColor Yellow

# Check if MCP server exists
if (-not (Test-Path $mcpServerPath)) {
    Write-Host "❌ MCP server not found at: $mcpServerPath" -ForegroundColor Red
    Write-Host "💡 Run 'npm run build' first to build the MCP server" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ MCP server found" -ForegroundColor Green

# Read environment variables from .env file
$envFile = "$currentDir\.env"
if (Test-Path $envFile) {
    Write-Host "📄 Reading environment variables from .env file..." -ForegroundColor Yellow
    
    $envContent = Get-Content $envFile
    $supabaseUrl = ""
    $supabaseKey = ""
    
    foreach ($line in $envContent) {
        if ($line -match "^SUPABASE_URL=(.+)$") {
            $supabaseUrl = $matches[1]
        }
        if ($line -match "^SUPABASE_SERVICE_KEY=(.+)$") {
            $supabaseKey = $matches[1]
        }
    }
    
    if ($supabaseUrl -and $supabaseKey) {
        Write-Host "✅ Found Supabase credentials" -ForegroundColor Green
    } else {
        Write-Host "❌ Could not find Supabase credentials in .env file" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    exit 1
}

# Create Claude Desktop config directory if it doesn't exist
$claudeDir = Split-Path $configPath -Parent
if (-not (Test-Path $claudeDir)) {
    Write-Host "📁 Creating Claude Desktop config directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

# Create the configuration
$config = @{
    mcpServers = @{
        "rms-supabase-server" = @{
            command = "node"
            args = @($mcpServerPath)
            env = @{
                SUPABASE_URL = $supabaseUrl
                SUPABASE_SERVICE_KEY = $supabaseKey
                JWT_SECRET = "your-super-secret-key-change-in-production"
            }
        }
    }
}

# Convert to JSON and save
$jsonConfig = $config | ConvertTo-Json -Depth 10
$jsonConfig | Out-File -FilePath $configPath -Encoding UTF8

Write-Host "✅ Claude Desktop configuration created at: $configPath" -ForegroundColor Green

# Test the MCP server
Write-Host "🧪 Testing MCP server..." -ForegroundColor Yellow

$env:SUPABASE_URL = $supabaseUrl
$env:SUPABASE_SERVICE_KEY = $supabaseKey

try {
    $process = Start-Process -FilePath "node" -ArgumentList $mcpServerPath -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    
    if (-not $process.HasExited) {
        Write-Host "✅ MCP server started successfully" -ForegroundColor Green
        $process.Kill()
    } else {
        Write-Host "❌ MCP server failed to start" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error testing MCP server: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Close Claude Desktop completely" -ForegroundColor White
Write-Host "2. Reopen Claude Desktop" -ForegroundColor White
Write-Host "3. Check if 'RMS Supabase Server' appears in the sidebar" -ForegroundColor White
Write-Host "4. Try asking: 'Find me the best rate for 2 containers from Mumbai to Los Angeles'" -ForegroundColor White

Write-Host "`n📋 Configuration Summary:" -ForegroundColor Cyan
Write-Host "• MCP Server: $mcpServerPath" -ForegroundColor White
Write-Host "• Supabase URL: $supabaseUrl" -ForegroundColor White
Write-Host "• Config File: $configPath" -ForegroundColor White

Write-Host "`n✅ Setup complete! Restart Claude Desktop to see the RMS tools." -ForegroundColor Green
