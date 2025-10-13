#!/bin/bash
# RMS MCP Server - VM Setup Script

echo "🚀 RMS MCP Server - VM Setup"
echo "=============================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
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
    git pull
else
    echo "📥 Cloning repository from GitHub..."
    git clone https://github.com/siduman268-debug/RMS-MCP-Server.git rms-mcp-server
    cd rms-mcp-server
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
echo "🐳 Building Docker image..."
docker-compose build

echo ""
echo "🚀 Starting RMS MCP Server..."
docker-compose up -d

echo ""
echo "⏳ Waiting for server to start..."
sleep 5

echo ""
echo "🏥 Testing health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is healthy!"
else
    echo "⚠️  Server may still be starting. Check logs with:"
    echo "   docker-compose logs -f rms-mcp-server"
fi

echo ""
echo "=============================="
echo "🎉 Setup Complete!"
echo "=============================="
echo ""
echo "📊 Server Status:"
docker-compose ps

echo ""
echo "🔗 Endpoints:"
echo "   Health Check: http://localhost:3000/health"
echo "   Search Rates: http://localhost:3000/api/search-rates"
echo "   Local Charges: http://localhost:3000/api/get-local-charges"
echo "   Prepare Quote: http://localhost:3000/api/prepare-quote"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop server:  docker-compose down"
echo "   Restart:      docker-compose restart"
echo "   Update code:  git pull && docker-compose up -d --build"
echo ""
echo "📚 Documentation:"
echo "   API Docs:     cat API_DOCUMENTATION.md"
echo "   Docker Guide: cat DOCKER_DEPLOYMENT.md"
echo "   n8n Setup:    cat N8N_SETUP_STEPS.md"
echo ""

