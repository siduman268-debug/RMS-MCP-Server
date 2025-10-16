# MCP Claude Desktop Troubleshooting Guide

## 🔍 Current Status
✅ **MCP Server**: Working correctly  
✅ **Build Process**: Successful  
✅ **Dependencies**: All installed  
⚠️ **Claude Desktop**: Needs configuration  

---

## 🛠️ Step-by-Step Fix

### 1. **Update Claude Desktop Configuration**

**Location**: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

**Add this configuration**:
```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "node",
      "args": ["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
      "env": {
        "SUPABASE_URL": "YOUR_ACTUAL_SUPABASE_URL",
        "SUPABASE_SERVICE_KEY": "YOUR_ACTUAL_SUPABASE_SERVICE_KEY",
        "JWT_SECRET": "your-super-secret-key-change-in-production"
      }
    }
  }
}
```

### 2. **Replace Environment Variables**

You need to replace:
- `YOUR_ACTUAL_SUPABASE_URL` - Your real Supabase project URL
- `YOUR_ACTUAL_SUPABASE_SERVICE_KEY` - Your real Supabase service key

### 3. **Restart Claude Desktop**

After updating the config file:
1. Close Claude Desktop completely
2. Reopen Claude Desktop
3. Check if RMS tools appear in the sidebar

---

## 🔧 Common Issues & Solutions

### Issue 1: "MCP server not found"
**Solution**: 
- Check the file path in `claude_desktop_config.json`
- Ensure `dist/index.js` exists
- Use absolute paths (not relative)

### Issue 2: "Environment variables not set"
**Solution**:
- Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
- Use your actual Supabase credentials
- Restart Claude Desktop after changes

### Issue 3: "MCP server crashes on startup"
**Solution**:
- Check Claude Desktop logs: `%APPDATA%\Claude\logs\`
- Verify Node.js is installed and accessible
- Test the server manually: `node dist/index.js`

### Issue 4: "Tools not appearing in Claude"
**Solution**:
- Ensure Claude Desktop version supports MCP (latest version)
- Check the MCP server name matches in config
- Restart Claude Desktop completely

---

## 🧪 Testing Steps

### 1. **Test MCP Server Manually**
```bash
cd C:\Users\Admin\RMS\rms-mcp-server
node dist/index.js
```
Should show: "RMS MCP Server running on stdio"

### 2. **Test with Environment Variables**
```bash
set SUPABASE_URL=your_url
set SUPABASE_SERVICE_KEY=your_key
node dist/index.js
```

### 3. **Check Claude Desktop Logs**
- Open: `%APPDATA%\Claude\logs\`
- Look for MCP-related errors
- Check for connection attempts

---

## 📋 Verification Checklist

- [ ] Claude Desktop is updated to latest version
- [ ] `claude_desktop_config.json` exists and is valid JSON
- [ ] File path to `dist/index.js` is correct and absolute
- [ ] Environment variables are set with real values
- [ ] Claude Desktop has been restarted after config changes
- [ ] MCP server starts without errors when run manually
- [ ] RMS tools appear in Claude Desktop sidebar

---

## 🆘 If Still Not Working

### Check Claude Desktop Version
- MCP support requires Claude Desktop 1.4.0 or later
- Update if needed

### Alternative Configuration
Try this simplified config:
```json
{
  "mcpServers": {
    "rms": {
      "command": "node",
      "args": ["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
      "env": {
        "SUPABASE_URL": "YOUR_URL",
        "SUPABASE_SERVICE_KEY": "YOUR_KEY"
      }
    }
  }
}
```

### Debug Mode
Add this to see more detailed logs:
```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "node",
      "args": ["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
      "env": {
        "SUPABASE_URL": "YOUR_URL",
        "SUPABASE_SERVICE_KEY": "YOUR_KEY",
        "DEBUG": "true"
      }
    }
  }
}
```

---

## 🎯 Expected Result

When working correctly, you should see:
1. **Claude Desktop Sidebar**: Shows "RMS Supabase Server" with 20+ tools
2. **Available Tools**: 
   - `price_enquiry`
   - `search_rates`
   - `create_freight_rate`
   - `update_freight_rate`
   - And many more...

3. **Test Query**: "Find me the best rate for 2 containers from Mumbai to Los Angeles"
   - Claude should use the `price_enquiry` tool automatically
   - Should return freight rate information

---

## 📞 Need Help?

If the issue persists:
1. Check Claude Desktop logs for specific error messages
2. Verify your Supabase credentials are correct
3. Test the MCP server independently
4. Ensure all file paths are correct and accessible

The MCP server itself is working correctly - the issue is likely in the Claude Desktop configuration or environment variables.
