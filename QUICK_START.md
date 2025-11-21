# 🚀 Quick Start Guide - RMS MCP Server

## For VM Deployment

### 1️⃣ Build and Start (First Time or After Code Changes)

```bash
# Full rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
docker-compose logs -f
```

**OR** (one-liner):
```bash
docker-compose down && docker-compose build && docker-compose up -d && docker-compose logs -f
```

---

### 2️⃣ Quick Restart (No Code Changes)

```bash
docker-compose restart
docker-compose logs -f
```

**OR** (one-liner):
```bash
docker-compose restart && docker-compose logs -f
```

---

### 3️⃣ Check Status

```bash
# Container status
docker-compose ps

# API health check
curl http://localhost:3000/health

# Test LCL endpoint
curl -X GET "http://localhost:3000/api/lcl-rates?limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 4️⃣ View Logs

```bash
# Follow logs in real-time
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Since specific time
docker-compose logs --since 5m
```

---

### 5️⃣ Stop Server

```bash
# Stop but keep data
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

---

## 🧪 Testing LCL APIs

### After starting the server:

```bash
# Make test script executable (if on Linux/Mac)
chmod +x test/test-lcl-crud.sh

# Run tests
./test/test-lcl-crud.sh
```

**OR** use the Windows PowerShell equivalent:

```powershell
# Test health
Invoke-RestMethod -Uri "http://localhost:3000/health"

# Test LCL rates
$headers = @{
    "Authorization" = "Bearer YOUR_JWT_TOKEN"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/lcl-rates?limit=5" -Headers $headers
```

---

## 📍 Ports

- **API Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

---

## 🔑 Environment Variables Required

Ensure your `.env` file contains:

```env
SUPABASE_URL=https://vlxybdhgfyaxnxzcgmtr.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
JWT_SECRET=your_jwt_secret_here
MAERSK_API_KEY=your_maersk_api_key
MAERSK_API_SECRET=your_maersk_secret
```

---

## 🆘 Troubleshooting

### Container won't start?
```bash
# Check logs
docker-compose logs --tail=50

# Check if port 3000 is already in use
netstat -an | grep 3000  # Linux/Mac
netstat -an | findstr 3000  # Windows
```

### Need fresh build?
```bash
# Build without cache
docker-compose build --no-cache
docker-compose up -d
```

### Permission issues?
```bash
# Run as root (if on Linux VM)
sudo docker-compose down
sudo docker-compose build
sudo docker-compose up -d
```

---

## ✅ What's Available Now

### LCL APIs (18 endpoints):
- ✅ `/api/lcl-rates` - Ocean freight rates CRUD + bulk
- ✅ `/api/lcl-surcharges` - Surcharges CRUD + bulk
- ✅ `/api/lcl-items` - Shipment items CRUD + bulk

### Coming Next:
- ⏳ `/api/v4/search-lcl-rates` - Search with slab matching
- ⏳ `/api/v4/prepare-lcl-quote` - Quote generation

---

**Last Updated**: 2025-11-21  
**Version**: 1.0.0 (LCL CRUD Complete)

