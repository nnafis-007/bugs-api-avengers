# Demo Script for End-to-End Tracing
# Run this to see complete tracing in action

Write-Host "`n🚀 End-to-End Tracing Demo`n" -ForegroundColor Cyan

# Generate unique correlation ID
$correlationId = "demo-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "📝 Correlation ID: $correlationId`n" -ForegroundColor Yellow

# Step 1: Register a user
Write-Host "Step 1: Registering new user..." -ForegroundColor Green
$registerHeaders = @{
    "Content-Type" = "application/json"
    "X-Correlation-ID" = $correlationId
}
$registerBody = @{
    email = "demo-user-$(Get-Random)@example.com"
    password = "Test123!@#"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost/api/register" -Method POST -Headers $registerHeaders -Body $registerBody
    Write-Host "✅ User registered successfully!" -ForegroundColor Green
    Write-Host "   Email: $($registerResponse.user.email)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 2

# Step 2: View campaigns
Write-Host "`nStep 2: Fetching campaigns..." -ForegroundColor Green
$campaignHeaders = @{
    "X-Correlation-ID" = "$correlationId-campaigns"
}

try {
    $campaigns = Invoke-RestMethod -Uri "http://localhost/api/campaigns" -Method GET -Headers $campaignHeaders
    Write-Host "✅ Found $($campaigns.Count) campaigns" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch campaigns: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Step 3: Login
Write-Host "`nStep 3: Logging in..." -ForegroundColor Green
$loginHeaders = @{
    "Content-Type" = "application/json"
    "X-Correlation-ID" = "$correlationId-login"
}
$loginBody = @{
    email = $registerResponse.user.email
    password = "Test123!@#"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost/api/login" -Method POST -Headers $loginHeaders -Body $loginBody
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   Access Token: $($loginResponse.accessToken.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n📊 Demo Complete!`n" -ForegroundColor Cyan
Write-Host "Now view the traces and logs:`n" -ForegroundColor Yellow
Write-Host "1. Jaeger (Tracing):" -ForegroundColor White
Write-Host "   http://localhost:16686" -ForegroundColor Gray
Write-Host "   → Select service: 'backend'" -ForegroundColor Gray
Write-Host "   → Click 'Find Traces'" -ForegroundColor Gray
Write-Host "   → Look for traces with tag: correlation.id=$correlationId`n" -ForegroundColor Gray

Write-Host "2. Kibana (Logs):" -ForegroundColor White
Write-Host "   http://localhost/kibana" -ForegroundColor Gray
Write-Host "   → Go to 'Discover'" -ForegroundColor Gray
Write-Host "   → Search: $correlationId" -ForegroundColor Gray
Write-Host "   → See logs from all services!`n" -ForegroundColor Gray

Write-Host "3. Grafana (Metrics):" -ForegroundColor White
Write-Host "   http://localhost/grafana" -ForegroundColor Gray
Write-Host "   → Username: admin / Password: grafana" -ForegroundColor Gray
Write-Host "   → View dashboards for real-time metrics`n" -ForegroundColor Gray

Write-Host "🎯 Correlation ID for searching: $correlationId`n" -ForegroundColor Cyan
