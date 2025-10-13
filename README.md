# RMS MCP Server

A Model Context Protocol (MCP) server that provides Claude with direct access to your RMS database via Supabase.

## Features

- **Pricing Enquiries**: Get ocean freight rates, calculate margins, and price quotations
- **Rate Management**: Create, update, and search freight rates and surcharges
- **Margin Rules**: Manage global, trade zone, and port-pair specific margin rules
- **Quotation Generation**: Create complete quotations from pricing data
- **Location & Vendor Management**: CRUD operations for ports, ICDs, and vendors
- **Helper Tools**: Search locations, list charge codes, and more

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit the `.env` file and add your Supabase credentials:

```env
SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**To get your Supabase Service Key:**
1. Go to your Supabase project dashboard
2. Click on "Project Settings" (gear icon in the sidebar)
3. Navigate to "API" section
4. Copy the `service_role` key (NOT the `anon` key)

⚠️ **Important**: The service role key has admin privileges. Never commit it to version control or share it publicly.

### 3. Build the Server

```bash
npm run build
```

### 4. Test the Server

```bash
npm run dev
```

## Usage with Claude Desktop

Add this configuration to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rms-supabase": {
      "command": "node",
      "args": ["C:\\Users\\Admin\\RMS\\rms-mcp-server\\dist\\index.js"],
      "env": {
        "SUPABASE_URL": "https://xsvwhctzwpfcwmmvbgmf.supabase.co",
        "SUPABASE_SERVICE_KEY": "your_service_role_key_here"
      }
    }
  }
}
```

After updating the config, restart Claude Desktop.

## Available Tools

### Pricing
- `price_enquiry` - Get complete pricing breakdown for a route
- `search_rates` - Find available freight rates
- `get_surcharges` - Get applicable surcharges

### Rate Management
- `create_freight_rate` - Add new ocean freight rate
- `update_freight_rate` - Modify existing rate
- `create_surcharge` - Add new surcharge
- `update_surcharge` - Modify surcharge

### Margin Rules
- `list_margin_rules` - View all margin rules
- `create_margin_rule` - Add new margin rule
- `update_margin_rule` - Modify margin rule
- `delete_margin_rule` - Remove margin rule

### Quotations
- `create_quotation` - Generate customer quotation
- `get_quotation` - Retrieve quotation by ID

### Data Management
- `list_vendors` - View vendors
- `update_vendor` - Modify vendor info
- `create_location` - Add port/ICD
- `update_location` - Modify location
- `search_locations` - Find ports/ICDs
- `list_charge_codes` - View charge codes

## Example Usage

Once connected to Claude Desktop, you can ask:

- "Price a shipment from Shanghai (CNSHA) to Los Angeles (USLAX) for a 40HC container"
- "Show me all margin rules for ocean freight"
- "Create a quotation for Acme Corp from Mumbai to Hamburg"
- "List all active ocean carriers"
- "What are the surcharges for INNSA to DEHAM?"

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

## Database Schema

This server expects the following Supabase tables and views:
- `locations` - Ports and ICDs
- `vendor` - Shipping lines and vendors
- `ocean_freight_rate` - Ocean freight rates
- `surcharge` - Additional charges
- `margin_rule_v2` - Margin calculation rules
- `charge_master` - Charge code definitions
- `v_preferred_ofr` - View for preferred rates
- `v_surcharges` - View for surcharge data

And the following RPC functions:
- `rms_pick_ofr_preferred_only` - Get preferred rate
- `apply_margin_allin_v2` - Calculate margins

## License

MIT

