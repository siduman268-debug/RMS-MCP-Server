# Development Setup - VM + Local Development

## Overview

This guide shows you how to maintain the same codebase across your Windows PC (for development with Cursor) and your VM (for deployment with Docker).

---

## Recommended Folder Structure

### On Windows PC (Development with Cursor)

```
C:\Users\Admin\RMS\
├── rms-mcp-server\          # Main project (this repo)
│   ├── src\
│   │   └── index.ts
│   ├── dist\
│   ├── node_modules\
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env                 # Local development
│   └── *.md
│
├── propelor-rms\            # React frontend
└── propelor-rms2\           # React QuoteBuilder
```

### On VM (Production Deployment)

```
/home/yourusername/RMS/
├── rms-mcp-server/          # Same repo, deployed
│   ├── src/
│   │   └── index.ts
│   ├── dist/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env                 # Production credentials
│   └── *.md
│
├── propelor-rms/            # Optional: Deploy frontend
└── propelor-rms2/           # Optional: Deploy QuoteBuilder
```

---

## Development Workflow

### 1. Develop on Windows with Cursor

```powershell
# Work on your code in Cursor
cd C:\Users\Admin\RMS\rms-mcp-server

# Make changes to src/index.ts
# Test locally
npm run dev

# Commit changes
git add .
git commit -m "feat: your changes"
git push
```

### 2. Deploy to VM

```bash
# SSH into VM
ssh user@your-vm-ip

# Navigate to project
cd ~/RMS/rms-mcp-server

# Pull latest changes
git pull

# Rebuild and restart Docker
docker-compose up -d --build

# Verify
curl http://localhost:3000/health
```

---

## Setup Guide

### Initial Setup on VM

#### Step 1: Create Same Folder Structure

```bash
# SSH into your VM
ssh user@your-vm-ip

# Create RMS directory
mkdir -p ~/RMS
cd ~/RMS

# Clone all your projects
git clone https://github.com/siduman268-debug/RMS-MCP-Server.git rms-mcp-server
git clone YOUR_PROPELOR_RMS_REPO propelor-rms
git clone YOUR_PROPELOR_RMS2_REPO propelor-rms2
```

#### Step 2: Configure Each Project

```bash
# RMS MCP Server
cd ~/RMS/rms-mcp-server

# Create .env file
nano .env
```

Paste:
```env
SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdndoY3R6d3BmY3dtbXZiZ21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMzUwMiwiZXhwIjoyMDc0Nzc5NTAyfQ.kY0FKyzntAj0RXgLyfe2y1dIeMlnGMfV50FSoyW0J2I
```

Save (Ctrl+O, Enter, Ctrl+X)

#### Step 3: Start Services

```bash
# Start RMS MCP Server with Docker
docker-compose up -d

# Verify
docker-compose ps
curl http://localhost:3000/health
```

---

## Remote Development Options

### Option 1: VSCode Remote SSH (Recommended)

Install **"Remote - SSH"** extension in VSCode/Cursor:

1. **Install Extension**: Remote - SSH
2. **Connect to VM**: 
   - Press F1
   - Type "Remote-SSH: Connect to Host"
   - Enter: `user@your-vm-ip`
3. **Open Folder**: `~/RMS/rms-mcp-server`
4. **Edit directly on VM**
5. **Changes are instant** - just rebuild Docker

**Benefits**:
- ✅ Edit files directly on VM
- ✅ See live logs
- ✅ No git push/pull needed for testing
- ✅ Full Cursor/VSCode features

### Option 2: Git-based Workflow (Current)

**Windows** (Development):
```powershell
# Edit in Cursor
# Test locally
npm run dev

# Commit and push
git add .
git commit -m "feat: new feature"
git push
```

**VM** (Production):
```bash
# Pull updates
git pull

# Deploy
docker-compose up -d --build
```

**Benefits**:
- ✅ Version controlled
- ✅ Test locally first
- ✅ Clean separation dev/prod

### Option 3: File Sync (Advanced)

Use **rsync** or **WinSCP** to sync files:

```bash
# From Windows (using WSL or Git Bash)
rsync -avz --exclude 'node_modules' --exclude 'dist' \
  /c/Users/Admin/RMS/rms-mcp-server/ \
  user@vm-ip:~/RMS/rms-mcp-server/
```

---

## Dual Environment Management

### Keep Both Environments in Sync

#### On Windows (.env):
```env
# Development
SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
SUPABASE_SERVICE_KEY=your_key_here
NODE_ENV=development
```

#### On VM (.env):
```env
# Production
SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
SUPABASE_SERVICE_KEY=your_key_here
NODE_ENV=production
```

**Both use same database**, but you can:
- Test on Windows before deploying
- Have dev/staging/prod Supabase projects

---

## Docker Development on Windows (Optional)

You can also run Docker on Windows for local testing:

```powershell
# On Windows (if you have Docker Desktop)
cd C:\Users\Admin\RMS\rms-mcp-server

# Start with Docker (same as VM)
docker-compose up

# Test
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

Then deploy exact same setup to VM!

---

## Git Workflow Best Practices

### Branch Strategy

```bash
# On Windows
git checkout -b feature/new-endpoint

# Make changes, test
npm run dev

# Commit
git add .
git commit -m "feat: add new endpoint"
git push origin feature/new-endpoint

# Create PR on GitHub
# Merge to master

# On VM
git checkout master
git pull
docker-compose up -d --build
```

### Quick Hotfix

```bash
# Windows: Fix bug
git add .
git commit -m "fix: urgent bug fix"
git push

# VM: Deploy immediately
git pull
docker-compose up -d --build
```

---

## VS Code / Cursor Remote Development Setup

### Install Remote SSH Extension

1. In Cursor/VSCode, press `Ctrl+Shift+X`
2. Search for **"Remote - SSH"**
3. Install by Microsoft

### Connect to VM

1. Press `F1`
2. Type: `Remote-SSH: Connect to Host`
3. Enter: `your-username@your-vm-ip`
4. Enter password
5. Wait for connection
6. Click **"Open Folder"**
7. Navigate to: `/home/yourusername/RMS/rms-mcp-server`

**Now you can**:
- Edit files directly on VM
- Use Cursor AI features
- Run terminal commands on VM
- See live Docker logs
- No need to push/pull for testing!

### Recommended Extensions on VM

Once connected via Remote SSH, install:
- **Docker** - Manage containers from VSCode
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitLens** - Advanced git features

---

## Folder Structure with Git Repositories

### Setup All Projects on VM

```bash
# On VM
cd ~/RMS

# Clone RMS MCP Server
git clone https://github.com/siduman268-debug/RMS-MCP-Server.git rms-mcp-server

# Clone Propelor RMS (if you have repos)
git clone https://github.com/siduman268-debug/RMS-Propelor.git propelor-rms2

# Clone other projects as needed
```

### Keep Everything Synced

```bash
# On VM - Update all projects
cd ~/RMS
for dir in */; do
  cd "$dir"
  echo "Updating $dir..."
  git pull
  cd ..
done
```

---

## Docker Compose for All Services (Future)

You can expand docker-compose.yml to include everything:

```yaml
version: '3.8'

services:
  # RMS MCP Server (API)
  rms-api:
    build: ./rms-mcp-server
    ports:
      - "3000:3000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    networks:
      - rms-network

  # n8n (Workflow Automation)
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - rms-network
    depends_on:
      - rms-api

  # Propelor RMS Frontend (Optional)
  propelor-frontend:
    build: ./propelor-rms2/propelor-rms2
    ports:
      - "3001:80"
    networks:
      - rms-network
    depends_on:
      - rms-api

networks:
  rms-network:
    driver: bridge

volumes:
  n8n_data:
```

**Start everything**:
```bash
docker-compose up -d
```

---

## Development Tips

### Hot Reload During Development

For active development, you can mount source code as volume:

```yaml
# docker-compose.dev.yml
services:
  rms-mcp-server:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src          # Mount source
      - ./dist:/app/dist        # Mount dist
    command: npm run dev        # Use dev mode
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
```

**Run dev mode**:
```bash
docker-compose -f docker-compose.dev.yml up
```

Changes to `src/index.ts` will auto-reload!

---

## Backup Strategy

### Automated Backups

```bash
# Backup script on VM
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups/rms

mkdir -p $BACKUP_DIR

# Backup code
cd ~/RMS
tar -czf $BACKUP_DIR/rms-code-$DATE.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  rms-mcp-server/

# Backup n8n workflows (if using Docker n8n)
docker cp n8n:/home/node/.n8n $BACKUP_DIR/n8n-workflows-$DATE

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

---

## Summary: Best Setup for You

### Recommended Architecture:

**Development (Windows PC)**:
- Use Cursor for editing
- Test locally with `npm run dev`
- Commit to GitHub

**Production (VM)**:
- Pull from GitHub
- Run with Docker
- Serve n8n workflows

**Alternative (All on VM)**:
- Use Remote SSH in Cursor
- Edit directly on VM
- Docker handles everything
- No sync needed!

---

## Quick Reference Commands

### Windows (Development):
```powershell
# Develop
cd C:\Users\Admin\RMS\rms-mcp-server
npm run dev

# Commit
git add .
git commit -m "feat: changes"
git push
```

### VM (Deployment):
```bash
# Update
cd ~/RMS/rms-mcp-server
git pull

# Deploy
docker-compose up -d --build

# Monitor
docker-compose logs -f

# Stop
docker-compose down
```

### Cursor Remote SSH (Best of Both):
```
1. Connect to VM via Remote SSH
2. Edit files on VM with Cursor
3. Changes saved directly to VM
4. Docker auto-rebuilds (if using dev mode)
```

---

## Which Setup Do You Prefer?

**A. Windows (Dev) + VM (Prod)** - Git-based sync  
**B. All on VM** - Edit via Remote SSH  
**C. Hybrid** - Develop on both as needed  

Let me know and I'll help you set it up! 🚀

