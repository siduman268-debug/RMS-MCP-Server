#!/bin/bash
# Quick VM Update Script for RMS MCP Server
# Updates code, rebuilds, and restarts the server

echo "🚀 RMS MCP Server - VM Update Script"
echo "======================================"
echo ""

# Navigate to RMS directory
cd ~/RMS/rms-mcp-server

# Pull latest changes
echo "📥 Pulling latest changes from git..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed. Check your connection and try again."
    exit 1
fi

echo "✅ Code updated successfully"
echo ""

# Install/update dependencies (if package.json changed)
echo "📦 Checking dependencies..."
npm install

echo ""

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Check for errors above."
    exit 1
fi

echo "✅ Build successful"
echo ""

# Check if Docker is running
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected. Checking Docker setup..."
    
    if [ -f docker-compose.yml ]; then
        echo "📋 Found docker-compose.yml"
        echo ""
        echo "To restart with Docker:"
        echo "  docker-compose down"
        echo "  docker-compose build"
        echo "  docker-compose up -d"
        echo ""
        read -p "Restart Docker containers now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🛑 Stopping containers..."
            docker-compose down
            
            echo "🔨 Rebuilding containers..."
            docker-compose build
            
            echo "🚀 Starting containers..."
            docker-compose up -d
            
            echo ""
            echo "⏳ Waiting for server to start..."
            sleep 5
            
            echo ""
            echo "📊 Container status:"
            docker-compose ps
            
            echo ""
            echo "📋 Recent logs:"
            docker-compose logs --tail=20
        fi
    else
        echo "⚠️  docker-compose.yml not found. Skipping Docker restart."
    fi
else
    echo "ℹ️  Docker not found. Running in Node.js mode."
    echo ""
    echo "To restart the server manually:"
    echo "  npm run build"
    echo "  npm start"
    echo "  # Or in production: pm2 restart rms-mcp-server"
fi

echo ""
echo "✅ VM update complete!"
echo ""
echo "Next steps:"
echo "1. Verify server is running: curl http://localhost:3000/health"
echo "2. Check logs if needed: docker-compose logs -f"
echo "3. Test MCP connection from Claude Desktop or Agent Force"

