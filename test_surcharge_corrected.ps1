# Test Surcharge CREATE API with corrected schema
Write-Host "Testing Surcharge CREATE API with corrected schema" -ForegroundColor Cyan

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

# Test CREATE Surcharge - Origin surcharge
Write-Host "Testing CREATE Surcharge (Origin)..." -ForegroundColor Yellow
$surchargeData = @{
    vendor_id = 4              # Required field
    contract_id = 1             # Required field
    charge_code = "THC"         # Required field
    amount = 200               # Required field
    currency = "USD"           # Required field
    uom = "per_cntr"           # Valid uom value
    applies_scope = "origin"   # Valid applies_scope value
    pol_code = "INNSA"         # Origin location
    valid_from = "2025-01-01"  # Required field
    valid_to = "2025-12-31"    # Required field
} | ConvertTo-Json

Write-Host "Request Data:" -ForegroundColor Cyan
Write-Host $surchargeData -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/surcharges" -Method POST -Headers $headers -Body $surchargeData -ContentType "application/json"
    Write-Host "✅ Surcharge Created Successfully!" -ForegroundColor Green
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

# Test CREATE Surcharge - Destination surcharge
Write-Host "Testing CREATE Surcharge (Destination)..." -ForegroundColor Yellow
$surchargeData2 = @{
    vendor_id = 4              # Required field
    contract_id = 1            # Required field
    charge_code = "BAF"        # Required field
    amount = 150              # Required field
    currency = "USD"          # Required field
    uom = "per_bl"            # Different valid uom value
    applies_scope = "dest"    # Valid applies_scope value (destination)
    pod_code = "USLAX"        # Destination location
    valid_from = "2025-01-01" # Required field
    valid_to = "2025-12-31"   # Required field
} | ConvertTo-Json

Write-Host "Request Data:" -ForegroundColor Cyan
Write-Host $surchargeData2 -ForegroundColor White

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:3000/api/surcharges" -Method POST -Headers $headers -Body $surchargeData2 -ContentType "application/json"
    Write-Host "✅ Surcharge Created Successfully!" -ForegroundColor Green
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

