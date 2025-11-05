#!/bin/bash
# Find RMS container IP on the shared network

echo "=== RMS Container IP on rms-mcp-server_rms-network ==="
docker inspect rms-mcp-server | grep -A 20 "rms-mcp-server_rms-network" | grep IPAddress

echo ""
echo "=== Testing connection from n8n container ==="
RMS_IP=$(docker inspect rms-mcp-server | grep -A 20 "rms-mcp-server_rms-network" | grep IPAddress | head -1 | awk -F'"' '{print $4}')
echo "RMS IP: $RMS_IP"
echo "Testing from n8n container..."
docker exec n8n wget -O- http://${RMS_IP}:3000/health

