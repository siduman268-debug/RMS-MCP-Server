#!/bin/bash
# Commands to check Docker network configuration

echo "=== Checking RMS container network ==="
docker inspect rms-mcp-server | grep -A 10 Networks

echo ""
echo "=== Checking n8n container network ==="
docker inspect n8n | grep -A 10 Networks

echo ""
echo "=== Listing all Docker networks ==="
docker network ls

