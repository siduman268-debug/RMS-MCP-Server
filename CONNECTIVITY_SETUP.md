# RMS Server ↔ n8n VM Connectivity Guide

## Network Setup for VM Communication

Since n8n is running on a **VM** and the RMS MCP Server is on your **Windows host**, you need to ensure they can communicate.

---

## Step 1: Get Your Windows IP Address

On your Windows machine (where RMS Server runs):

```powershell
ipconfig
```

Look for:
- **IPv4 Address**: `192.168.x.x` or `10.x.x.x`
- Note this IP - you'll use it in n8n

**Example**:
```
Ethernet adapter Ethernet:
   IPv4 Address. . . . . . . . . . . : 192.168.88.5
```

---

## Step 2: Configure RMS Server to Accept VM Connections

The RMS server is already configured to listen on all network interfaces (`0.0.0.0:3000`), so it should accept connections from your VM.

**Verify it's running**:
```powershell
# On Windows host
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

---

## Step 3: Test Connection from VM

From your n8n VM, test if it can reach the RMS server:

```bash
# Replace 192.168.88.5 with your actual Windows IP
curl http://192.168.88.5:3000/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "service": "rms-api",
  "timestamp": "2025-10-13T..."
}
```

---

## Step 4: Update n8n Workflow URLs

In n8n, update all HTTP Request nodes:

**Replace**:
```
http://localhost:3000
```

**With**:
```
http://192.168.88.5:3000
```
(Use your actual Windows IP)

---

## Troubleshooting Connection Issues

### Issue: "Connection Refused"

**Possible Causes**:
1. **Firewall blocking**: Windows Firewall may block incoming connections
2. **RMS Server not running**: Verify it's active
3. **Wrong IP address**: Double-check the IP

**Solutions**:

#### A. Allow Port 3000 in Windows Firewall

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "RMS API Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

#### B. Verify Server is Running

```powershell
# On Windows
Get-Process | Where-Object {$_.ProcessName -eq "node"}
```

Should show the node process running.

#### C. Test Locally First

```powershell
# On Windows
Invoke-RestMethod -Uri "http://localhost:3000/health"
Invoke-RestMethod -Uri "http://192.168.88.5:3000/health"
```

Both should work.

---

## Step 5: Configure n8n Workflow

### Option A: Manual Build (Recommended for Learning)

Follow the steps in `N8N_SETUP_STEPS.md` but use:
- **URL**: `http://YOUR_WINDOWS_IP:3000/api/...`

### Option B: Import and Modify

1. Import `n8n-workflow-example.json`
2. Open each HTTP Request node
3. Update URLs:
   - Search Rates: `http://192.168.88.5:3000/api/search-rates`
   - Get Local Charges: `http://192.168.88.5:3000/api/get-local-charges`
   - Prepare Quote: `http://192.168.88.5:3000/api/prepare-quote`

---

## Alternative: Run Everything on VM

If you prefer to run both on the VM:

### 1. Copy RMS Server to VM

```bash
# On VM
git clone https://github.com/siduman268-debug/RMS-MCP-Server.git
cd RMS-MCP-Server
npm install
```

### 2. Configure Environment Variables

```bash
# On VM
export SUPABASE_URL="https://xsvwhctzwpfcwmmvbgmf.supabase.co"
export SUPABASE_SERVICE_KEY="your_service_key_here"
```

### 3. Build and Run

```bash
npm run build
node dist/index.js &
```

### 4. Use localhost in n8n

Now you can use `http://localhost:3000` in your n8n workflows!

---

## Network Configurations

### Configuration 1: VM → Windows Host
```
┌─────────────┐         ┌──────────────────┐
│   n8n VM    │ ──────▶ │  Windows Host    │
│  (workflow) │         │  (RMS Server)    │
│             │         │  :3000           │
└─────────────┘         └──────────────────┘
    Uses: http://192.168.88.5:3000
```

**Pros**: Keep RMS server on main machine  
**Cons**: Need firewall configuration

---

### Configuration 2: Everything on VM
```
┌─────────────────────────────┐
│         n8n VM              │
│  ┌──────────┐               │
│  │   n8n    │               │
│  └────┬─────┘               │
│       │                     │
│       ▼                     │
│  ┌──────────┐               │
│  │   RMS    │               │
│  │  Server  │               │
│  │  :3000   │               │
│  └──────────┘               │
└─────────────────────────────┘
    Uses: http://localhost:3000
```

**Pros**: Simple networking, no firewall issues  
**Cons**: Need to deploy RMS to VM

---

### Configuration 3: Cloud Deployment
```
┌─────────────┐         ┌──────────────────┐
│   n8n       │ ──────▶ │  RMS Server      │
│  (Cloud)    │         │  (Heroku/        │
│             │         │   Railway)       │
└─────────────┘         └──────────────────┘
    Uses: https://rms-api.yourcompany.com
```

**Pros**: Accessible from anywhere, scalable  
**Cons**: Requires cloud deployment

---

## Quick Setup Commands

### On Windows Host (RMS Server):

```powershell
# 1. Get your IP
ipconfig | Select-String "IPv4"

# 2. Allow firewall
New-NetFirewallRule -DisplayName "RMS API" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# 3. Start RMS Server
cd C:\Users\Admin\RMS\rms-mcp-server
$env:SUPABASE_URL="https://xsvwhctzwpfcwmmvbgmf.supabase.co"
$env:SUPABASE_SERVICE_KEY="your_key_here"
node dist/index.js
```

### On n8n VM:

```bash
# Test connection
curl http://YOUR_WINDOWS_IP:3000/health

# If successful, proceed with workflow setup
```

---

## Ready to Build?

Choose your approach:

**A. Quick Start (5 minutes)**:
1. Allow port 3000 in Windows Firewall
2. Get your Windows IP
3. Import workflow in n8n
4. Update URLs to use your IP
5. Test!

**B. Full Setup (15 minutes)**:
1. Follow steps 1-6 in N8N_SETUP_STEPS.md
2. Add email notification
3. Test thoroughly
4. Customize to your needs

**C. Deploy to VM**:
1. Clone repo to VM
2. Install dependencies
3. Configure environment
4. Run both services on VM

Which approach would you like to take?

---

*Need help? Check the server logs or test endpoints individually first!*

