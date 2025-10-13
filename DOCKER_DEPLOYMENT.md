# Docker Deployment Guide - RMS MCP Server

## Overview

This guide will help you deploy the RMS MCP Server to your VM using Docker. This is the **recommended approach** as it provides:

✅ **Easy deployment** - Single command to start  
✅ **Isolation** - No dependency conflicts  
✅ **Portability** - Run anywhere with Docker  
✅ **Scalability** - Easy to add more services  
✅ **Networking** - n8n can easily connect to RMS server

---

## Prerequisites

- ✅ Docker installed on VM
- ✅ Docker Compose installed (usually comes with Docker)
- ✅ Git installed on VM

---

## Quick Start (5 Minutes)

### 1. Clone Repository to VM

```bash
# SSH into your VM, then:
cd ~
git clone https://github.com/siduman268-debug/RMS-MCP-Server.git
cd RMS-MCP-Server
```

### 2. Create Environment File

```bash
# Create .env file with your Supabase credentials
cat > .env << 'EOF'
SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdndoY3R6d3BmY3dtbXZiZ21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMzUwMiwiZXhwIjoyMDc0Nzc5NTAyfQ.kY0FKyzntAj0RXgLyfe2y1dIeMlnGMfV50FSoyW0J2I
EOF
```

### 3. Build and Run

```bash
# Build and start the container
docker-compose up -d

# Check if it's running
docker-compose ps

# View logs
docker-compose logs -f rms-mcp-server
```

### 4. Test the Server

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test search-rates endpoint
curl -X POST http://localhost:3000/api/search-rates \
  -H "Content-Type: application/json" \
  -d '{"pol_code":"INNSA","pod_code":"NLRTM","container_type":"40HC"}'
```

**Expected Response**:
```json
{
  "status": "ok",
  "service": "rms-api",
  "timestamp": "..."
}
```

✅ **Done! Server is running on port 3000**

---

## Full Docker Setup with n8n

### Option 1: Run Both RMS + n8n Together

Edit `docker-compose.yml` and uncomment the n8n service section:

```yaml
version: '3.8'

services:
  rms-mcp-server:
    build: .
    container_name: rms-mcp-server
    ports:
      - "3000:3000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    restart: unless-stopped
    networks:
      - rms-network

  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=ChangeThisPassword123
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - WEBHOOK_URL=http://YOUR_VM_IP:5678/
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - rms-network
    restart: unless-stopped
    depends_on:
      - rms-mcp-server

networks:
  rms-network:
    driver: bridge

volumes:
  n8n_data:
```

Then run:

```bash
# Start both services
docker-compose up -d

# Access n8n at: http://YOUR_VM_IP:5678
# Username: admin
# Password: ChangeThisPassword123
```

**In n8n workflows, use**: `http://rms-mcp-server:3000` (Docker network name)

---

## Docker Commands Reference

### Starting Services

```bash
# Start in background
docker-compose up -d

# Start with logs visible
docker-compose up

# Start only RMS server
docker-compose up -d rms-mcp-server
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop specific service
docker-compose stop rms-mcp-server
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f rms-mcp-server

# Last 100 lines
docker-compose logs --tail=100 rms-mcp-server
```

### Rebuilding After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Force rebuild (no cache)
docker-compose build --no-cache
docker-compose up -d
```

### Monitoring

```bash
# Check status
docker-compose ps

# Check resource usage
docker stats rms-mcp-server

# Inspect container
docker inspect rms-mcp-server
```

---

## Network Configuration

### Container-to-Container Communication

When both RMS and n8n are in Docker:

**In n8n HTTP Request nodes, use**:
```
http://rms-mcp-server:3000/api/search-rates
```

**NOT**:
```
http://localhost:3000/api/search-rates  ❌
```

### External Access

**From outside the VM**:
```
http://YOUR_VM_IP:3000/health
http://YOUR_VM_IP:5678  (n8n interface)
```

**From Windows host**:
```powershell
Invoke-RestMethod -Uri "http://YOUR_VM_IP:3000/health"
```

---

## Environment Variables

### Method 1: Using .env file (Recommended)

Create `.env` in project root:
```bash
SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
SUPABASE_SERVICE_KEY=your_actual_key_here
```

Docker Compose automatically loads this file.

### Method 2: Pass directly in docker-compose.yml

```yaml
services:
  rms-mcp-server:
    environment:
      - SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
      - SUPABASE_SERVICE_KEY=eyJhbGc...
```

### Method 3: Environment variables on host

```bash
export SUPABASE_URL="https://xsvwhctzwpfcwmmvbgmf.supabase.co"
export SUPABASE_SERVICE_KEY="your_key"
docker-compose up -d
```

---

## Updating the Server

### Quick Update Process

```bash
# On VM
cd ~/RMS-MCP-Server

# Pull latest changes
git pull

# Rebuild and restart
docker-compose up -d --build

# Verify
curl http://localhost:3000/health
```

### Zero-Downtime Update (Advanced)

```bash
# Build new image
docker-compose build

# Start new container
docker-compose up -d --no-deps --build rms-mcp-server

# Old container is automatically replaced
```

---

## File Structure on VM

```
/home/yourusername/
├── RMS-MCP-Server/          # Git repository
│   ├── src/
│   │   └── index.ts         # Source code
│   ├── dist/                # Built files (created by Docker)
│   ├── node_modules/        # (inside container only)
│   ├── Dockerfile           # Docker build instructions
│   ├── docker-compose.yml   # Service orchestration
│   ├── .env                 # Environment variables (create this)
│   ├── .dockerignore        # Files to exclude from Docker
│   ├── package.json
│   ├── tsconfig.json
│   └── *.md                 # Documentation
│
└── n8n-data/                # n8n workflows (if using Docker n8n)
    └── .n8n/
```

---

## Production Best Practices

### 1. Use Docker Volumes for Persistence

If you add database or file storage later:

```yaml
volumes:
  - ./data:/app/data
  - ./logs:/app/logs
```

### 2. Configure Logging

Already configured in docker-compose.yml:
- Max size: 10MB per file
- Max files: 3 (30MB total)

View logs:
```bash
docker-compose logs -f --tail=100
```

### 3. Auto-Restart on Failure

Already configured: `restart: unless-stopped`

### 4. Resource Limits (Optional)

Add to docker-compose.yml:
```yaml
services:
  rms-mcp-server:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs rms-mcp-server

# Check if port is already in use
sudo netstat -tulpn | grep 3000

# Remove and restart
docker-compose down
docker-compose up -d
```

### Can't Connect from n8n

```bash
# Test from inside n8n container
docker exec -it n8n sh
wget http://rms-mcp-server:3000/health

# Check network
docker network inspect rms-mcp-server_rms-network
```

### Environment Variables Not Loading

```bash
# Verify .env file exists
cat .env

# Check what env vars container sees
docker exec rms-mcp-server env | grep SUPABASE
```

### Rebuild Issues

```bash
# Clean rebuild
docker-compose down
docker system prune -f
docker-compose build --no-cache
docker-compose up -d
```

---

## Deployment Steps Summary

### On Your VM:

```bash
# 1. Clone repository
git clone https://github.com/siduman268-debug/RMS-MCP-Server.git
cd RMS-MCP-Server

# 2. Create .env file with your credentials
nano .env
# Add SUPABASE_URL and SUPABASE_SERVICE_KEY

# 3. Start with Docker
docker-compose up -d

# 4. Check health
curl http://localhost:3000/health

# 5. Test endpoints
curl -X POST http://localhost:3000/api/search-rates \
  -H "Content-Type: application/json" \
  -d '{"pol_code":"INNSA","pod_code":"NLRTM","container_type":"40HC"}'
```

### In n8n (on same VM):

**Use these URLs in HTTP Request nodes**:
- `http://rms-mcp-server:3000/api/search-rates`
- `http://rms-mcp-server:3000/api/get-local-charges`
- `http://rms-mcp-server:3000/api/prepare-quote`

---

## Benefits of Docker Deployment

✅ **Simplified networking** - n8n and RMS on same Docker network  
✅ **Easy updates** - `git pull && docker-compose up -d --build`  
✅ **Consistent environment** - Same setup dev/prod  
✅ **Auto-restart** - Server comes back after crashes  
✅ **Resource management** - Control CPU/memory limits  
✅ **Easy cleanup** - `docker-compose down` removes everything  

---

## Next Steps

1. **Transfer files to VM** (git clone)
2. **Create .env file** with credentials
3. **Run docker-compose up -d**
4. **Configure n8n workflows** to use `http://rms-mcp-server:3000`
5. **Test and enjoy!**

---

*Your RMS server will be accessible at `http://YOUR_VM_IP:3000` from anywhere on your network!*

