# V4 API Test Script
# Run this AFTER restarting the server

$BASE_URL = "http://localhost:3000"
$TENANT_ID = "00000000-0000-0000-0000-000000000001"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V4 API Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get JWT Token
Write-Host "Step 1: Getting JWT Token..." -ForegroundColor Yellow
try {
    $tokenResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/token" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body "{`"tenant_id`":`"$TENANT_ID`"}"
    $token = $tokenResponse.token
    Write-Host "✅ Token obtained" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get token: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "x-tenant-id" = $TENANT_ID
    "Content-Type" = "application/json"
}

# Step 2: Test V4 Search Rates
Write-Host "`nStep 2: Testing V4 Search Rates..." -ForegroundColor Yellow
try {
    $body = @{
        origin = "INNSA"
        destination = "NLRTM"
        container_type = "40HC"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/v4/search-rates" `
        -Method Post `
        -Headers $headers `
        -Body $body
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Found $($result.data.Count) rates" -ForegroundColor White
    if ($result.data.Count -gt 0) {
        Write-Host "   First rate origin: $($result.data[0].origin)" -ForegroundColor White
        Write-Host "   First rate destination: $($result.data[0].destination)" -ForegroundColor White
    }
    Write-Host "`nFull response:" -ForegroundColor Gray
    $result | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

# Step 3: Test V4 Prepare Quote
Write-Host "`nStep 3: Testing V4 Prepare Quote..." -ForegroundColor Yellow
try {
    $body = @{
        salesforce_org_id = "00DBE000002eBzh"
        origin = "INNSA"
        destination = "NLRTM"
        container_type = "40HC"
        container_count = 1
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/v4/prepare-quote" `
        -Method Post `
        -Headers $headers `
        -Body $body
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Route origin: $($result.data.route.origin)" -ForegroundColor White
    Write-Host "   Route destination: $($result.data.route.destination)" -ForegroundColor White
    Write-Host "   Grand total: $($result.data.totals.grand_total_usd) USD" -ForegroundColor White
    Write-Host "`nFull response:" -ForegroundColor Gray
    $result | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

# Step 4: Test V1 (Backward Compatibility)
Write-Host "`nStep 4: Testing V1 Search Rates (Backward Compatibility)..." -ForegroundColor Yellow
try {
    $body = @{
        pol_code = "INNSA"
        pod_code = "NLRTM"
        container_type = "40HC"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/search-rates" `
        -Method Post `
        -Headers $headers `
        -Body $body
    
    Write-Host "✅ SUCCESS! V1 still works" -ForegroundColor Green
    Write-Host "   Found $($result.data.Count) rates" -ForegroundColor White
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Tests Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

