#!/bin/bash
# ============================================================================
# Deploy Vendor/Contract Card UI Updates to VM
# ============================================================================

set -e  # Exit on error

echo "========================================"
echo "Deploying Vendor/Contract Card UI"
echo "========================================"

# Navigate to project directory
cd ~/rms-mcp-server || { echo "Project directory not found!"; exit 1; }

echo ""
echo "📥 Step 1: Pulling latest code from GitHub..."
git pull origin master

echo ""
echo "🛑 Step 2: Stopping Docker containers..."
docker-compose down

echo ""
echo "🔨 Step 3: Building Docker image..."
docker-compose build --no-cache

echo ""
echo "🚀 Step 4: Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for service to be healthy (30 seconds)..."
sleep 30

echo ""
echo "🏥 Step 5: Checking service health..."
curl -s http://localhost:3000/health | jq

echo ""
echo "✅ Step 6: Testing contracts API..."
TOKEN=$(curl -s -X POST "http://localhost:3000/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

echo "Token: $TOKEN"

echo ""
echo "Testing /api/contracts endpoint..."
curl -s -X GET "http://localhost:3000/api/contracts?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq

echo ""
echo "========================================"
echo "✅ Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Verify contract_number field in response"
echo "2. Verify vendor_name field in response"
echo "3. Deploy LWC to Salesforce"
echo ""
echo "To view logs: docker-compose logs -f --tail=50"
echo "========================================"

