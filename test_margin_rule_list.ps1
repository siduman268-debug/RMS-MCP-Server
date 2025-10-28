# Test Margin Rule LIST API
Write-Host "Testing Margin Rule LIST API" -ForegroundColor Cyan

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

# Test LIST Margin Rules
Write-Host "Testing LIST Margin Rules..." -ForegroundColor Yellow
try {
    $listResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/margin-rules" -Method GET -Headers $headers
    Write-Host "✅ Margin Rules Retrieved Successfully!" -ForegroundColor Green
    Write-Host "Total margin rules: $($listResponse.data.Count)" -ForegroundColor Cyan
    
    # Show all margin rules
    Write-Host "`nAll Margin Rules:" -ForegroundColor Yellow
    $listResponse.data | ForEach-Object {
        $rule = $_
        Write-Host "  - ID: $($rule.id), Level: $($rule.level), Mark: $($rule.mark_kind) $($rule.mark_value), Priority: $($rule.priority)" -ForegroundColor White
        if ($rule.pol_id -and $rule.pod_id) {
            Write-Host "    Route: POL=$($rule.pol_id.Substring(0,8))..., POD=$($rule.pod_id.Substring(0,8))..." -ForegroundColor Gray
        }
    }
    
    # Test filtering by level
    Write-Host "`nTesting filter by level=global..." -ForegroundColor Yellow
    $filteredResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/margin-rules?level=global" -Method GET -Headers $headers
    Write-Host "Global margin rules: $($filteredResponse.data.Count)" -ForegroundColor Cyan
    
    # Test filtering by mark_kind
    Write-Host "`nTesting filter by mark_kind=pct..." -ForegroundColor Yellow
    $pctResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/margin-rules?mark_kind=pct" -Method GET -Headers $headers
    Write-Host "Percentage margin rules: $($pctResponse.data.Count)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}

