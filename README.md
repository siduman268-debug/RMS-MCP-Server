# RMS MCP Server

A comprehensive freight rate management server that provides:
- **MCP Protocol** for Claude Desktop integration
- **HTTP REST API** for n8n workflow automation and external integrations
- **Supabase Backend** for real-time data access

## Features

### MCP Tools (Claude Desktop)
- **Pricing Enquiries**: Get ocean freight rates, calculate margins, and price quotations
- **Rate Management**: Create, update, and search freight rates and surcharges
- **Margin Rules**: Manage global, trade zone, and port-pair specific margin rules
- **Quotation Generation**: Create complete quotations from pricing data
- **Location & Vendor Management**: CRUD operations for ports, ICDs, and vendors
- **Helper Tools**: Search locations, list charge codes, and more

### HTTP API (n8n Integration)
- **Search Rates**: Find ocean freight rates with flexible filtering
- **Get Local Charges**: Retrieve origin/destination charges with FX conversion
- **Prepare Quote**: Generate complete quotes with automatic currency conversion
- **Health Check**: Monitor server status

## Quick Start

### Option 1: Docker Deployment (Recommended for VM)

```bash
# Clone repository
git clone https://github.com/siduman268-debug/RMS-MCP-Server.git
cd RMS-MCP-Server

# Create .env file
echo "SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co" > .env
echo "SUPABASE_SERVICE_KEY=your_service_key" >> .env

# Start with Docker
docker-compose up -d

# Test
curl http://localhost:3000/health
```

**See DOCKER_DEPLOYMENT.md for complete guide**

### Option 2: Node.js Development (Local)

```bash
# Install dependencies
npm install

# Create .env file
SUPABASE_URL=https://xsvwhctzwpfcwmmvbgmf.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Build
npm run build

# Run
npm run dev
```

**See DEVELOPMENT_SETUP.md for development workflow**

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

## HTTP API Usage (n8n / External Integration)

The server runs a Fastify HTTP API on port 3000 alongside the MCP protocol.

### API Endpoints

**Base URL**: `http://localhost:3000`

- `GET /health` - Health check
- `POST /api/search-rates` - Search ocean freight rates (V1)
- `POST /api/v2/search-rates` - Enhanced rate search (V2)
- `POST /api/v2/prepare-quote` - Rate-specific quote (V2)
- `POST /api/v3/prepare-quote` - Enhanced quote with inland (V3)
- `POST /api/v3/get-inland-haulage` - Get inland haulage charges (V3)
- `POST /api/v4/search-rates` - Search with origin/destination fields (V4) ✨ NEW
- `POST /api/v4/prepare-quote` - Quote with automatic inland & schedules (V4) ✨ NEW
- `POST /api/get-local-charges` - Get origin/destination charges

**Example**:
```bash
curl -X POST http://localhost:3000/api/prepare-quote \
  -H "Content-Type: application/json" \
  -d '{
    "pol_code": "INNSA",
    "pod_code": "NLRTM",
    "container_type": "40HC",
    "container_count": 2
  }'
```

**See API_DOCUMENTATION.md for complete API reference**

## n8n Workflow Automation

Import the pre-built workflow:
1. Open n8n
2. Import `n8n-workflow-example.json`
3. Configure HTTP Request nodes to point to RMS server
4. Activate workflow

**See N8N_WORKFLOW_GUIDE.md for complete integration guide**

## Available Tools (MCP)

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

## Documentation

- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete HTTP API reference
- **[DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)** - Docker deployment guide
- **[N8N_WORKFLOW_GUIDE.md](./N8N_WORKFLOW_GUIDE.md)** - n8n integration examples
- **[N8N_SETUP_STEPS.md](./N8N_SETUP_STEPS.md)** - Step-by-step workflow setup
- **[CONNECTIVITY_SETUP.md](./CONNECTIVITY_SETUP.md)** - Network configuration
- **[DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md)** - Development workflow guide

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  Claude Desktop │◄────────┤  RMS MCP Server  │
│   (MCP Client)  │  stdio  │                  │
└─────────────────┘         │   ┌──────────┐   │
                            │   │   MCP    │   │
┌─────────────────┐         │   │  Server  │   │
│      n8n        │◄────────┤   └──────────┘   │
│  (HTTP Client)  │  :3000  │                  │
└─────────────────┘         │   ┌──────────┐   │
                            │   │  Fastify │   │
                            │   │   HTTP   │   │
                            │   └──────────┘   │
                            │         │        │
                            │         ▼        │
                            │   ┌──────────┐   │
                            │   │ Supabase │   │
                            │   │  Client  │   │
                            │   └──────────┘   │
                            └─────────┬────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │  Supabase Cloud  │
                            │   (Database)     │
                            └──────────────────┘
```

## Quick Deploy to VM

```bash
# One-line setup (on Linux VM)
curl -sSL https://raw.githubusercontent.com/siduman268-debug/RMS-MCP-Server/master/setup-vm.sh | bash
```

Or manually follow **DOCKER_DEPLOYMENT.md**

## License

MIT
