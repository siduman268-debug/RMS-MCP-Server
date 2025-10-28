# Test Margin Rule CREATE API
Write-Host "Testing Margin Rule CREATE API" -ForegroundColor Cyan

# Get authentication token
Write-Host "Getting authentication token..." -ForegroundColor Yellow
try {
    $tokenResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/token" -Method POST -Body '{"tenant_id": "00000000-0000-0000-0000-000000000001"}' -ContentType "application/json"
    $token = $tokenResponse.token
    $headers = @{
        "Authorization" = "Bearer $token"
        "x-tenant-id" = "00000000-0000-0000-0000-000000000001"
    }
    Write-Host "Token obtained successfully" -ForegroundColor Green
} catch {
    Write-Host "Token Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test CREATE Margin Rule - Global margin rule
Write-Host "Testing CREATE Margin Rule (Global)..." -ForegroundColor Yellow
$marginRuleData = @{
    level = "global"           # Rule level (global, trade_zone, port_pair)
    mark_kind = "pct"         # Margin type (pct, flat)
    mark_value = 15.5        # Margin value (15.5%)
    priority = 100           # Priority (higher = applied first)
    valid_from = "2025-01-01" # Valid from date
    valid_to = "2025-12-31"   # Valid to date
} | ConvertTo-Json

Write-Host "Request Data:" -ForegroundColor Cyan
Write-Host $marginRuleData -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/margin-rules" -Method POST -Headers $headers -Body $marginRuleData -ContentType "application/json"
    Write-Host "✅ Margin Rule Created Successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}

Write-Host "`n" -ForegroundColor White

# Test CREATE Margin Rule - Port pair specific margin rule
Write-Host "Testing CREATE Margin Rule (Port Pair)..." -ForegroundColor Yellow
$marginRuleData2 = @{
    level = "port_pair"       # Rule level
    pol_code = "INNSA"        # Port of Loading
    pod_code = "USLAX"        # Port of Discharge
    mark_kind = "flat"       # Margin type (flat amount)
    mark_value = 500         # Margin value ($500 flat)
    priority = 200           # Higher priority
    valid_from = "2025-01-01" # Valid from date
    valid_to = "2025-12-31"   # Valid to date
} | ConvertTo-Json

Write-Host "Request Data:" -ForegroundColor Cyan
Write-Host $marginRuleData2 -ForegroundColor White

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3000/api/margin-rules" -Method POST -Headers $headers -Body $marginRuleData2 -ContentType "application/json"
    Write-Host "✅ Margin Rule Created Successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response2 | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}

