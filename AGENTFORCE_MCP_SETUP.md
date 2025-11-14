# Agent Force MCP Server Setup Guide

This guide explains how to set up the RMS MCP Server to work with Agent Force, enabling all MCP tools to be available in your Agent Force environment.

## Overview

Agent Force can connect to MCP (Model Context Protocol) servers and use their tools. The RMS MCP Server provides comprehensive access to:
- Pricing and rate information
- Vessel schedules
- Location/port data
- Margin rules
- Inland haulage charges
- Schedule metrics and reporting

## Prerequisites

1. **RMS MCP Server** - Built and running (see `DEVELOPMENT_SETUP.md`)
2. **Agent Force** - Access to Salesforce Agent Force
3. **Node.js** - Version 18+ installed
4. **Environment Variables** - Supabase credentials configured

## Step 1: Build the MCP Server

Ensure the MCP server is built with all latest changes:

```bash
cd C:\Users\Admin\RMS\rms-mcp-server
npm install
npm run build
```

Verify the build was successful:
```bash
dir dist\index.js
```

## Step 2: Configure Agent Force MCP Connection

Agent Force connects to MCP servers via stdio (standard input/output). You need to configure Agent Force to launch the MCP server process.

### Option A: Using Agent Force Configuration File

Create or update the Agent Force configuration file (location depends on your Agent Force setup):

**For .NET Agent Framework:**
```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "node",
      "args": ["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-key-here",
        "JWT_SECRET": "your-super-secret-key-change-in-production"
      }
    }
  }
}
```

**For Python Agent Framework:**
```python
from agent_framework import ChatAgent, MCPStdioTool

async with MCPStdioTool(
    name="rms-supabase-server",
    command="node",
    args=["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
    env={
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-key-here",
        "JWT_SECRET": "your-super-secret-key-change-in-production"
    }
) as mcp_server:
    # Initialize your agent with the MCP tools
    agent = ChatAgent(tools=[mcp_server])
```

### Option B: Programmatic Setup

If your Agent Force setup uses code-based configuration:

**C# (.NET):**
```csharp
using Microsoft.AgentFramework;
using Microsoft.AgentFramework.ModelContextProtocol;

// Create MCP client
await using var mcpClient = await McpClientFactory.CreateAsync(new StdioClientTransport(new()
{
    Name = "rms-supabase-server",
    Command = "node",
    Arguments = new[] { @"C:\Users\Admin\RMS\rms-mcp-server\dist\index.js" },
    Environment = new Dictionary<string, string>
    {
        ["SUPABASE_URL"] = "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        ["SUPABASE_SERVICE_KEY"] = "your-service-key-here",
        ["JWT_SECRET"] = "your-super-secret-key-change-in-production"
    }
}));

// Get available tools
var tools = await mcpClient.ListToolsAsync();

// Initialize your agent with MCP tools
var agent = new ChatAgent(tools: tools);
```

## Step 3: Available MCP Tools

Once connected, Agent Force will have access to all the following tools:

### Pricing & Rates
- `price_enquiry` - Price an enquiry with complete breakdown
- `search_rates` - Search for ocean freight rates
- `get_surcharges` - Get applicable surcharges

### Vessel Schedules (NEW)
- `search_schedules` - Search vessel schedules with route details
- `get_schedule_metrics` - Get statistics on schedule data sources
- `get_schedule_audit_stats` - Get historical schedule statistics
- `get_carrier_schedule_breakdown` - Carrier-wise schedule source breakdown

### Locations & Ports
- `search_locations` - Search for ports/ICDs
- `create_location` - Create a new location
- `update_location` - Update location information

### Vendors & Carriers
- `list_vendors` - List all vendors
- `update_vendor` - Update vendor information
- `list_carriers` - List all carriers (NEW)
- `list_services` - List carrier services/routes (NEW)

### Margin Rules
- `create_margin_rule` - Create a margin rule
- `update_margin_rule` - Update a margin rule
- `delete_margin_rule` - Delete a margin rule
- `list_margin_rules` - List margin rules

### Inland Haulage
- `get_inland_haulage` - Get IHE/IHI charges

### Quotations
- `create_quotation` - Create a quotation
- `get_quotation` - Retrieve a quotation

### Helper Tools
- `list_charge_codes` - List charge codes

## Step 4: Testing the Connection

### Test 1: List Available Tools

In your Agent Force environment, invoke:
```json
{
  "tool": "list_tools"
}
```

You should see all the tools listed above.

### Test 2: Search Schedules

Test the schedule search functionality:
```json
{
  "tool": "search_schedules",
  "arguments": {
    "origin": "INNSA",
    "destination": "NLRTM",
    "weeks": 4,
    "limit": 10
  }
}
```

### Test 3: Get Schedule Metrics

Test the metrics endpoint:
```json
{
  "tool": "get_schedule_metrics",
  "arguments": {
    "origin": "INNSA",
    "destination": "NLRTM",
    "weeks": 4
  }
}
```

## Step 5: Environment-Specific Configuration

### Development Environment
Use local paths and development credentials:
```json
{
  "command": "node",
  "args": ["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Production Environment
Use production paths and secure credentials:
```json
{
  "command": "node",
  "args": ["/opt/rms/rms-mcp-server/dist/index.js"],
  "env": {
    "NODE_ENV": "production",
    "SUPABASE_URL": "production-url",
    "SUPABASE_SERVICE_KEY": "production-key"
  }
}
```

## Troubleshooting

### Issue: Agent Force cannot connect to MCP server

**Solution:**
1. Verify the path to `dist/index.js` is correct
2. Ensure Node.js is in the system PATH
3. Test the server manually: `node dist/index.js`
4. Check environment variables are set correctly

### Issue: Tools not appearing in Agent Force

**Solution:**
1. Ensure the server starts successfully
2. Check server logs for errors
3. Verify `ListToolsRequestSchema` handler is working
4. Restart Agent Force after configuration changes

### Issue: Tool execution fails

**Solution:**
1. Check Supabase connection is working
2. Verify tenant context is set correctly
3. Review error messages in server logs
4. Ensure required parameters are provided

## Security Considerations

1. **Environment Variables**: Store sensitive credentials securely
2. **Service Keys**: Use service role keys only in secure environments
3. **JWT Secret**: Change default JWT secret in production
4. **Network Security**: Ensure MCP server is only accessible from trusted sources

## Additional Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Agent Force Documentation](https://learn.microsoft.com/en-us/agent-framework/)
- [RMS MCP Server Source Code](../src/index.ts)
- [API Documentation](./API_DOCUMENTATION_V4.md)

## Support

For issues or questions:
- Check server logs for error messages
- Verify all prerequisites are met
- Review the troubleshooting section
- Check GitHub issues for known problems

---

*Last Updated: 2025-11-14*  
*MCP Server Version: 1.0.0*

