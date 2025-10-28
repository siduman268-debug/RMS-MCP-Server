# Test Ocean Freight Rate CRUD APIs
Write-Host "🚢 Testing Ocean Freight Rate CRUD APIs" -ForegroundColor Cyan

# Get authentication token
Write-Host "🔑 Getting authentication token..." -ForegroundColor Yellow
$tokenResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/token" -Method POST -Body '{"tenant_id": "00000000-0000-0000-0000-000000000001"}' -ContentType "application/json"
$token = $tokenResponse.token
$headers = @{
    "Authorization" = "Bearer $token"
    "x-tenant-id" = "00000000-0000-0000-0000-000000000001"
}

Write-Host "✅ Token obtained: $($token.Substring(0,20))..." -ForegroundColor Green

# Test 1: CREATE Ocean Freight Rate
Write-Host "`n📝 Testing CREATE Ocean Freight Rate..." -ForegroundColor Yellow
$rateData = @{
    vendor_id = 4
    contract_id = 4
    pol_code = "INNSA"
    pod_code = "USNYC"
    container_type = "20GP"
    rate_amount = 1500
    currency = "USD"
    valid_from = "2025-01-01"
    valid_to = "2025-12-31"
    transit_days = 25
} | ConvertTo-Json

try {
    $createResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/ocean-freight-rates" -Method POST -Headers $headers -Body $rateData -ContentType "application/json"
    Write-Host "✅ CREATE Success!" -ForegroundColor Green
    Write-Host "Created Rate ID: $($createResponse.id)" -ForegroundColor Cyan
    $createdRateId = $createResponse.id
} catch {
    Write-Host "❌ CREATE Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: READ Single Rate
Write-Host "`n📖 Testing READ Single Rate..." -ForegroundColor Yellow
try {
    $readResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/ocean-freight-rates/$createdRateId" -Method GET -Headers $headers
    Write-Host "✅ READ Success!" -ForegroundColor Green
    Write-Host "Rate Details: $($readResponse.pol_code) -> $($readResponse.pod_code) - $($readResponse.container_type) - $($readResponse.rate_amount) $($readResponse.currency)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ READ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: UPDATE Rate
Write-Host "`n✏️ Testing UPDATE Rate..." -ForegroundColor Yellow
$updateData = @{
    rate_amount = 1600
    transit_days = 30
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/ocean-freight-rates/$createdRateId" -Method PUT -Headers $headers -Body $updateData -ContentType "application/json"
    Write-Host "✅ UPDATE Success!" -ForegroundColor Green
    Write-Host "Updated Rate: $($updateResponse.rate_amount) $($updateResponse.currency) - $($updateResponse.transit_days) days" -ForegroundColor Cyan
} catch {
    Write-Host "❌ UPDATE Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: LIST All Rates
Write-Host "`n📋 Testing LIST All Rates..." -ForegroundColor Yellow
try {
    $listResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/ocean-freight-rates" -Method GET -Headers $headers
    Write-Host "✅ LIST Success!" -ForegroundColor Green
    Write-Host "Total Rates: $($listResponse.data.Count)" -ForegroundColor Cyan
    Write-Host "First 3 rates:" -ForegroundColor Cyan
    $listResponse.data | Select-Object -First 3 | ForEach-Object {
        Write-Host "  - $($_.pol_code) -> $($_.pod_code) - $($_.container_type) - $($_.rate_amount) $($_.currency)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ LIST Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: DELETE Rate
Write-Host "`n🗑️ Testing DELETE Rate..." -ForegroundColor Yellow
try {
    $deleteResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/ocean-freight-rates/$createdRateId" -Method DELETE -Headers $headers
    Write-Host "✅ DELETE Success!" -ForegroundColor Green
    Write-Host "Rate $createdRateId deleted successfully" -ForegroundColor Cyan
} catch {
    Write-Host "❌ DELETE Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Ocean Freight Rate CRUD API Test Complete!" -ForegroundColor Green
