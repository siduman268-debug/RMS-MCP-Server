# Docker Commands for RMS MCP Server

## 🐳 Build and Start Commands

### 1. Build the Docker Image
```bash
docker-compose build
```

### 2. Start the Container
```bash
docker-compose up -d
```

### 3. Restart the Container
```bash
docker-compose restart
```

### 4. Stop the Container
```bash
docker-compose down
```

### 5. Rebuild and Restart (Fresh Start)
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### 6. View Logs
```bash
# Follow logs in real-time
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service logs
docker-compose logs -f rms-mcp-server
```

### 7. Check Container Status
```bash
docker-compose ps
```

### 8. Execute Commands Inside Container
```bash
# Interactive shell
docker-compose exec rms-mcp-server /bin/bash

# Run npm commands
docker-compose exec rms-mcp-server npm run build
docker-compose exec rms-mcp-server npm test
```

---

## 🔧 Quick Commands (One-Liners)

### Full Rebuild and Restart
```bash
docker-compose down && docker-compose build && docker-compose up -d && docker-compose logs -f
```

### Quick Restart (No Rebuild)
```bash
docker-compose restart && docker-compose logs -f
```

### Clean Restart (Remove Volumes)
```bash
docker-compose down -v && docker-compose build && docker-compose up -d
```

---

## 📊 Health Check

### Test API Endpoint
```bash
# Health check
curl http://localhost:3000/health

# Test LCL endpoint
curl -X GET http://localhost:3000/api/lcl-rates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🛠️ Troubleshooting

### View Container Details
```bash
docker-compose ps -a
```

### Check Resource Usage
```bash
docker stats
```

### Clean Up Everything
```bash
# Remove all containers, volumes, and images
docker-compose down -v --rmi all
```

### Rebuild Without Cache
```bash
docker-compose build --no-cache
```

---

## 📝 Notes

- **Port**: The API runs on port `3000` by default
- **Environment Variables**: Ensure `.env` file has:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `JWT_SECRET`
  - `MAERSK_API_KEY`
  - `MAERSK_CONSUMER_SECRET`
- **Logs Location**: Check `docker-compose logs` for any startup errors



