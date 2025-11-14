# Claude Desktop MCP Server Setup Guide

This guide explains how to configure Claude Desktop to use the RMS MCP Server with all schedule tools.

## Overview

The RMS MCP Server provides Claude Desktop with access to:
- **Pricing & Rates**: Price enquiries, search rates, get surcharges
- **Vessel Schedules** ✨ NEW: Search schedules, get metrics, audit stats
- **Locations & Ports**: Search, create, update locations
- **Vendors & Carriers**: List vendors/carriers, update vendor info
- **Margin Rules**: Create, update, delete, list margin rules
- **Inland Haulage**: Get IHE/IHI charges
- **Quotations**: Create and retrieve quotations
- **Helper Tools**: List charge codes, search locations

## Prerequisites

1. **RMS MCP Server** - Built and ready (see `DEVELOPMENT_SETUP.md`)
2. **Node.js** - Version 18+ installed
3. **Claude Desktop** - Installed on your system

## Step 1: Locate Claude Desktop Config File

The configuration file location depends on your operating system:

### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```
Typically: `C:\Users\<YourUsername>\AppData\Roaming\Claude\claude_desktop_config.json`

### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Linux
```
~/.config/Claude/claude_desktop_config.json
```

## Step 2: Update Configuration File

Open the `claude_desktop_config.json` file and add or update the `mcpServers` section:

### Windows Configuration

```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "node",
      "args": ["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdndoY3R6d3BmY3dtbXZiZ21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMzUwMiwiZXhwIjoyMDc0Nzc5NTAyfQ.kY0FKyzntAj0RXgLyfe2y1dIeMlnGMfV50FSoyW0J2I",
        "JWT_SECRET": "your-super-secret-key-change-in-production"
      }
    }
  }
}
```

### macOS/Linux Configuration

```json
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "node",
      "args": ["/path/to/rms-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-key-here",
        "JWT_SECRET": "your-super-secret-key-change-in-production"
      }
    }
  }
}
```

**Important**: Update the path in `args` to match your actual installation path!

## Step 3: Restart Claude Desktop

After updating the configuration:
1. **Save** the `claude_desktop_config.json` file
2. **Quit Claude Desktop** completely
3. **Restart Claude Desktop**
4. The MCP server will start automatically

## Step 4: Verify Connection

Once Claude Desktop restarts, you can verify the connection by asking Claude:

- "What MCP tools are available?"
- "Can you list all the schedule tools?"
- "Search for vessel schedules from INNSA to NLRTM"

## Available Schedule Tools (NEW!)

The following schedule tools are now available:

### 1. `search_schedules`
Search for vessel schedules between origin and destination ports.

**Usage Example**:
```
Search for vessel schedules from Nhava Sheva (INNSA) to Rotterdam (NLRTM) 
for the next 4 weeks
```

**Parameters**:
- `origin` (required): Origin port UN/LOCODE (e.g., 'INNSA', 'CNSHA')
- `destination` (optional): Destination port UN/LOCODE
- `departure_from` (optional): Start date (YYYY-MM-DD, defaults to today)
- `departure_to` (optional): End date (YYYY-MM-DD)
- `weeks` (optional): Number of weeks from departure_from (2, 4, or 6)
- `limit` (optional): Maximum results (default: 100, max: 500)

### 2. `get_schedule_metrics`
Get statistics on schedule data sources for a specific search.

**Usage Example**:
```
Get schedule source statistics for INNSA to NLRTM searches
```

**Returns**: Counts and percentages for Database, Portcast, and Line API sources

### 3. `get_schedule_audit_stats`
Get historical statistics on schedule data sources from the audit table.

**Usage Example**:
```
Get audit statistics for Maersk carrier schedules from the last 30 days
```

**Parameters**:
- `carrier` (optional): Filter by carrier name
- `start_date` (optional): Filter from this date
- `end_date` (optional): Filter until this date
- `limit` (optional): Max records (default: 1000)

### 4. `get_carrier_schedule_breakdown`
Get a breakdown of schedule sources grouped by carrier.

**Usage Example**:
```
Show me which carriers have schedules from which sources
```

### 5. `list_carriers`
List all carriers/vendors available in the system.

**Usage Example**:
```
List all active carriers
```

### 6. `list_services`
List carrier services (routes) available in the system.

**Usage Example**:
```
List all services for Maersk carrier
```

## Complete Tool List

### Pricing & Rates (3 tools)
- `price_enquiry` - Price an enquiry with complete breakdown
- `search_rates` - Search for ocean freight rates
- `get_surcharges` - Get applicable surcharges

### Vessel Schedules (6 tools) ✨ NEW
- `search_schedules` - Search vessel schedules
- `get_schedule_metrics` - Get schedule source statistics
- `get_schedule_audit_stats` - Get historical audit statistics
- `get_carrier_schedule_breakdown` - Carrier-wise source breakdown
- `list_carriers` - List all carriers
- `list_services` - List carrier services

### Locations & Ports (3 tools)
- `search_locations` - Search for ports/ICDs
- `create_location` - Create a new location
- `update_location` - Update location information

### Vendors & Carriers (4 tools)
- `list_vendors` - List all vendors
- `update_vendor` - Update vendor information
- `list_carriers` - List all carriers
- `list_services` - List carrier services

### Margin Rules (4 tools)
- `create_margin_rule` - Create a margin rule
- `update_margin_rule` - Update a margin rule
- `delete_margin_rule` - Delete a margin rule
- `list_margin_rules` - List margin rules

### Inland Haulage (1 tool)
- `get_inland_haulage` - Get IHE/IHI charges

### Quotations (2 tools)
- `create_quotation` - Create a quotation
- `get_quotation` - Retrieve a quotation

### Helper Tools (1 tool)
- `list_charge_codes` - List charge codes

**Total: 26 tools available**

## Troubleshooting

### Issue: Claude Desktop doesn't see the MCP server

**Solutions**:
1. Verify the path in `args` is correct and uses escaped backslashes (`\\`) on Windows
2. Ensure Node.js is in your system PATH
3. Check that `dist/index.js` exists
4. Verify environment variables are correct
5. Check Claude Desktop console for error messages (View → Developer → Show Console)

### Issue: Tools not appearing

**Solutions**:
1. Restart Claude Desktop completely
2. Check that the MCP server starts (look for server process)
3. Verify Supabase credentials are correct
4. Check server logs for errors

### Issue: Schedule tools not working

**Solutions**:
1. Ensure the latest build includes schedule tools: `npm run build`
2. Verify schedule services are properly imported
3. Check Supabase connection is working
4. Test with `search_schedules` tool first

## Testing the Connection

After setup, test with these prompts:

```
What schedule tools are available?
```

```
Search for vessel schedules from INNSA (Nhava Sheva) to NLRTM (Rotterdam) 
for the next 4 weeks
```

```
Get schedule metrics for INNSA to NLRTM route
```

```
List all carriers in the system
```

## Security Notes

1. **Environment Variables**: Keep your `SUPABASE_SERVICE_KEY` secure
2. **Config File**: The config file contains sensitive keys - restrict access
3. **JWT Secret**: Change the default JWT secret in production
4. **Service Key**: Use service role keys only in trusted environments

## Additional Resources

- [RMS MCP Server Source](../src/index.ts)
- [API Documentation](../API_DOCUMENTATION_V4.md)
- [Development Setup](../DEVELOPMENT_SETUP.md)
- [Agent Force Setup](./AGENTFORCE_MCP_SETUP.md)

---

*Last Updated: 2025-11-14*  
*MCP Server Version: 1.0.0*  
*Schedule Tools Added: 2025-11-14*

