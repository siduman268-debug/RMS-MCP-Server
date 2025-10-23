#!/bin/bash
# RMS MCP Server - VM Deployment Script (Updated with V3 API)
# This script deploys the complete RMS system with V1, V2, V3 APIs and n8n orchestration

echo "🚀 RMS MCP Server - Complete VM Deployment"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    echo "   Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    echo "   Install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker found: $(docker --version)"
echo "✅ Docker Compose found: $(docker-compose --version)"
echo ""

# Create RMS directory structure
echo "📁 Creating directory structure..."
mkdir -p ~/RMS
cd ~/RMS

# Check if repository already exists
if [ -d "rms-mcp-server" ]; then
    echo "📂 Repository already exists. Pulling latest changes..."
    cd rms-mcp-server
    git pull origin master
    echo "✅ Repository updated to latest version"
else
    echo "📥 Cloning repository from GitHub..."
    git clone https://github.com/siduman268-debug/RMS-MCP-Server.git rms-mcp-server
    cd rms-mcp-server
    echo "✅ Repository cloned successfully"
fi

echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    echo "Please enter your Supabase credentials:"
    echo ""
    
    read -p "SUPABASE_URL (press Enter for default): " SUPABASE_URL
    SUPABASE_URL=${SUPABASE_URL:-https://xsvwhctzwpfcwmmvbgmf.supabase.co}
    
    read -p "SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY
    
    cat > .env << EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
NODE_ENV=production
PORT=3000
EOF
    
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo ""

# Deploy database functions
echo "🗄️  Deploying database functions..."
echo "Please run the following SQL in your Supabase SQL editor:"
echo ""
echo "1. Copy and paste the contents of 'database_views_production.sql'"
echo "2. Copy and paste the contents of 'simplified_v3_ihe_ihi.sql'"
echo "3. Execute both SQL scripts in Supabase"
echo ""
read -p "Press Enter when database functions are deployed..."

echo ""

# Build Docker image
echo "🐳 Building Docker image..."
docker-compose build

echo ""

# Start RMS MCP Server
echo "🚀 Starting RMS MCP Server..."
docker-compose up -d

echo ""

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

echo ""

# Test all API endpoints
echo "🧪 Testing API endpoints..."

# Test health endpoint
echo "Testing health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Health endpoint: OK"
else
    echo "❌ Health endpoint: FAILED"
fi

# Test V1 API
echo "Testing V1 API..."
V1_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000001","user_id":"test_user"}' 2>/dev/null)

if echo "$V1_RESPONSE" | grep -q "token"; then
    echo "✅ V1 API: OK"
else
    echo "❌ V1 API: FAILED"
fi

# Test V2 API
echo "Testing V2 API..."
V2_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v2/prepare-quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(echo $V1_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"salesforce_org_id":"test","rate_id":166,"container_count":1}' 2>/dev/null)

if echo "$V2_RESPONSE" | grep -q "success"; then
    echo "✅ V2 API: OK"
else
    echo "❌ V2 API: FAILED"
fi

# Test V3 API
echo "Testing V3 API..."
V3_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v3/prepare-quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(echo $V1_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -d '{"pol_code":"INTKD","pod_code":"NLRTM","container_type":"40HC","cargo_weight_mt":25,"haulage_type":"carrier"}' 2>/dev/null)

if echo "$V3_RESPONSE" | grep -q "success"; then
    echo "✅ V3 API: OK"
else
    echo "❌ V3 API: FAILED"
fi

echo ""

# Display server status
echo "📊 Server Status:"
docker-compose ps

echo ""

# Display available endpoints
echo "🔗 Available Endpoints:"
echo "   Health Check:     http://localhost:3000/health"
echo "   V1 Search Rates:  http://localhost:3000/api/search-rates"
echo "   V1 Prepare Quote: http://localhost:3000/api/prepare-quote"
echo "   V2 Search Rates:  http://localhost:3000/api/v2/search-rates"
echo "   V2 Prepare Quote: http://localhost:3000/api/v2/prepare-quote"
echo "   V3 Inland Quote:  http://localhost:3000/api/v3/prepare-quote"
echo ""

# Display n8n workflow information
echo "🔄 n8n Orchestration:"
echo "   Orchestrated Workflow: n8n-orchestrated-v1-v3-workflow.json"
echo "   V2 Salesforce Workflow: n8n-salesforce-v2-simplified-workflow.json"
echo "   Import these workflows into your n8n instance"
echo ""

# Display useful commands
echo "📝 Useful Commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop server:      docker-compose down"
echo "   Restart:          docker-compose restart"
echo "   Update code:      git pull && docker-compose up -d --build"
echo "   Check status:     docker-compose ps"
echo ""

# Display documentation
echo "📚 Documentation:"
echo "   API Documentation: cat API_DOCUMENTATION.md"
echo "   Docker Guide:     cat DOCKER_DEPLOYMENT.md"
echo "   n8n Setup:        cat N8N_WORKFLOW_GUIDE.md"
echo ""

# Display architecture summary
echo "🏗️  Architecture Summary:"
echo "   V1 API: Ocean freight + Local charges (414.11 USD for Rotterdam)"
echo "   V2 API: Rate-specific quotes with Salesforce integration"
echo "   V3 API: Inland haulage charges (624 USD for INTKD IHE)"
echo "   n8n: Orchestrates V1 + V3 for complete inland quotes"
echo "   MCP: Claude Desktop integration via stdio"
echo ""

echo "=============================="
echo "🎉 Deployment Complete!"
echo "=============================="
echo ""
echo "Next Steps:"
echo "1. Import n8n workflows into your n8n instance"
echo "2. Configure n8n to connect to http://localhost:3000"
echo "3. Test the orchestrated workflow with sample emails"
echo "4. Configure Claude Desktop with claude_desktop_config.json"
echo ""
