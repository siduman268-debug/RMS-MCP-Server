# Claude Desktop VM Configuration Guide

This guide explains how to configure Claude Desktop to use the RMS MCP Server running on your VM instead of locally.

## Current Configuration

The current `claude_desktop_config.json` points to:
- **Local path**: `C:\Users\Admin\RMS\rms-mcp-server\dist\index.js`

This means the MCP server runs on your local Windows machine.

## VM Configuration Options

### Option 1: SSH Connection (Recommended for Remote VM)

Use SSH to execute the MCP server on the VM remotely. This works best if your VM is accessible via SSH.

#### Windows Setup (using OpenSSH or WSL)

1. **Ensure SSH is available on Windows**:
   - Windows 10/11 has OpenSSH client by default
   - Or use WSL (Windows Subsystem for Linux) which includes SSH

2. **Update `claude_desktop_config.json`**:

```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "ssh",
      "args": [
        "your-username@vm-ip-or-hostname",
        "-n",
        "-o", "StrictHostKeyChecking=no",
        "cd ~/RMS/rms-mcp-server && node dist/index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-key-here",
        "JWT_SECRET": "your-secret-here"
      }
    }
  }
}
```

**Replace**:
- `your-username@vm-ip-or-hostname` with your actual VM SSH connection (e.g., `ubuntu@192.168.1.100` or `root@vm.example.com`)

3. **Set up SSH Key Authentication (Recommended)**:
   ```bash
   # Generate SSH key if you don't have one
   ssh-keygen -t rsa -b 4096
   
   # Copy public key to VM
   ssh-copy-id your-username@vm-ip-or-hostname
   ```

#### Windows Setup (using PuTTY/Plink)

If you prefer PuTTY, update the config:

```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "C:\\Program Files\\PuTTY\\plink.exe",
      "args": [
        "-ssh",
        "your-username@vm-ip-or-hostname",
        "-batch",
        "-pw", "your-password",
        "cd ~/RMS/rms-mcp-server && node dist/index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-key-here",
        "JWT_SECRET": "your-secret-here"
      }
    }
  }
}
```

**Note**: Password in config is not secure. Use SSH keys instead.

### Option 2: Network Mount (For Local Network VM)

If your VM is on the same network and you can mount it as a network drive:

1. **Mount VM directory as network drive** (e.g., `Z:\`)

2. **Update config to use network path**:

```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "node",
      "args": ["Z:\\RMS\\rms-mcp-server\\dist\\index.js"],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-key-here",
        "JWT_SECRET": "your-secret-here"
      }
    }
  }
}
```

**Note**: This still runs Node.js locally but reads the code from VM. The server execution will happen on your local machine.

### Option 3: HTTP Bridge (Alternative Approach)

If SSH is not available, you could create a bridge that exposes MCP over HTTP, but this is more complex and not standard MCP protocol.

## Recommended Setup: SSH with Key Authentication

### Step 1: Get VM Connection Details

You need:
- VM IP address or hostname
- SSH username
- SSH port (default: 22)

### Step 2: Test SSH Connection

```bash
# From Windows PowerShell or CMD
ssh your-username@vm-ip-or-hostname

# Or from WSL
ssh your-username@vm-ip-or-hostname
```

### Step 3: Verify Server Path on VM

Once connected to VM:
```bash
cd ~/RMS/rms-mcp-server
ls -la dist/index.js
node dist/index.js --version  # Should show Node.js version or start server
```

### Step 4: Update Claude Desktop Config

Copy the VM configuration:

```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "ssh",
      "args": [
        "YOUR-USERNAME@YOUR-VM-IP",
        "-n",
        "cd ~/RMS/rms-mcp-server && node dist/index.js"
      ],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdndoY3R6d3BmY3dtbXZiZ21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMzUwMiwiZXhwIjoyMDc0Nzc5NTAyfQ.kY0FKyzntAj0RXgLyfe2y1dIeMlnGMfV50FSoyW0J2I",
        "JWT_SECRET": "your-super-secret-key-change-in-production"
      }
    }
  }
}
```

**Important**: Replace `YOUR-USERNAME@YOUR-VM-IP` with your actual values.

### Step 5: Set Up SSH Key Authentication (Optional but Recommended)

1. **Generate SSH key** (if you don't have one):
   ```bash
   ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
   ```

2. **Copy public key to VM**:
   ```bash
   ssh-copy-id your-username@vm-ip-or-hostname
   ```

3. **Test passwordless login**:
   ```bash
   ssh your-username@vm-ip-or-hostname
   ```

If successful, you won't need to enter a password each time.

## Troubleshooting

### Issue: "ssh: command not found"

**Windows Solution**:
- Install OpenSSH for Windows (usually pre-installed on Windows 10/11)
- Or use WSL (Windows Subsystem for Linux)
- Or use PuTTY's plink.exe

### Issue: "Permission denied"

**Solutions**:
1. Check SSH key authentication is set up
2. Verify username and IP are correct
3. Check VM firewall allows SSH (port 22)
4. Verify SSH service is running on VM

### Issue: "node: command not found" on VM

**Solution**: Node.js must be installed on the VM:
```bash
# On VM
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Issue: "Cannot find module" errors

**Solution**: Ensure dependencies are installed on VM:
```bash
# On VM
cd ~/RMS/rms-mcp-server
npm install
npm run build
```

### Issue: Connection timeout

**Solutions**:
1. Verify VM IP address is correct
2. Check VM is running and accessible
3. Check firewall allows SSH connections
4. Verify SSH port (may not be 22)

## Testing the Connection

1. **Test SSH connection manually**:
   ```bash
   ssh your-username@vm-ip "node --version"
   ```

2. **Test server path**:
   ```bash
   ssh your-username@vm-ip "cd ~/RMS/rms-mcp-server && ls -la dist/index.js"
   ```

3. **Restart Claude Desktop** and verify MCP server connects

## Security Notes

1. **SSH Keys**: Use SSH key authentication instead of passwords
2. **Firewall**: Ensure only necessary ports are open on VM
3. **VPN**: If VM is in a private network, use VPN for secure access
4. **Service Keys**: Keep SUPABASE_SERVICE_KEY secure

## Current Status

✅ **Local Config**: Currently pointing to `C:\Users\Admin\RMS\rms-mcp-server\dist\index.js`  
🔄 **VM Config**: Ready to use - just update the SSH connection string

---

*Last Updated: 2025-11-14*  
*See `claude_desktop_config-vm.json` for template*

