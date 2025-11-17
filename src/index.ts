#!/usr/bin/env node

/**
 * RMS MCP Server - Supabase Integration
 * Provides Claude with direct access to RMS database
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Fastify from 'fastify';
// import { InlandPricingService } from './INLAND_PRICING_SERVICE.js'; // Not needed for simplified V3
import cors from '@fastify/cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { addScheduleRoutes } from './routes/schedule-routes.js';
import { addV4Routes } from './routes/v4-routes.js';
import { addScheduleMetricsRoutes } from './routes/schedule-metrics-routes.js';

// Load environment variables
dotenv.config();

// Environment variables are passed directly by Claude Desktop

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_TTL = process.env.JWT_TTL || '1h';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// MCP SERVER SETUP
// ============================================

const server = new Server(
  {
    name: "rms-supabase-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================
// TOOL DEFINITIONS
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ==========================================
      // 1. PRICING ENQUIRIES
      // ==========================================
      {
        name: "price_enquiry",
        description: "Price an enquiry by finding best rates, calculating margins, and creating leg pricing. Returns complete pricing breakdown with buy/sell amounts.",
        inputSchema: {
          type: "object",
          properties: {
            pol_code: {
              type: "string",
              description: "Port of Loading UN/LOCODE (e.g., 'CNSHA', 'INNSA')",
            },
            pod_code: {
              type: "string",
              description: "Port of Discharge UN/LOCODE (e.g., 'USLAX', 'DEHAM')",
            },
            container_type: {
              type: "string",
              description: "Container type (e.g., '20GP', '40GP', '40HC')",
            },
            container_count: {
              type: "number",
              description: "Number of containers",
              default: 1,
            },
          },
          required: ["pol_code", "pod_code", "container_type"],
        },
      },
      {
        name: "search_rates",
        description: "Search for available ocean freight rates between ports. Returns preferred vendor rates with transit times.",
        inputSchema: {
          type: "object",
          properties: {
            pol_code: {
              type: "string",
              description: "Port of Loading UN/LOCODE",
            },
            pod_code: {
              type: "string",
              description: "Port of Discharge UN/LOCODE",
            },
            container_type: {
              type: "string",
              description: "Container type (optional)",
            },
            vendor_name: {
              type: "string",
              description: "Filter by vendor name (optional)",
            },
          },
          required: ["pol_code", "pod_code"],
        },
      },
      {
        name: "get_surcharges",
        description: "Get all applicable surcharges for a route and container type",
        inputSchema: {
          type: "object",
          properties: {
            pol_code: {
              type: "string",
              description: "Port of Loading UN/LOCODE",
            },
            pod_code: {
              type: "string",
              description: "Port of Discharge UN/LOCODE",
            },
            container_type: {
              type: "string",
              description: "Container type",
            },
            vendor_id: {
              type: "number",
              description: "Filter by vendor ID (optional)",
            },
          },
          required: ["pol_code", "pod_code"],
        },
      },

      // ==========================================
      // 2. UPDATE RATES & DATA
      // ==========================================
      {
        name: "update_freight_rate",
        description: "Update an ocean freight rate (buy amount, validity dates, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            rate_id: {
              type: "number",
              description: "Ocean freight rate ID",
            },
            updates: {
              type: "object",
              description: "Fields to update (buy_amount, valid_from, valid_to, is_preferred, tt_days)",
              properties: {
                buy_amount: { type: "number" },
                valid_from: { type: "string", format: "date" },
                valid_to: { type: "string", format: "date" },
                is_preferred: { type: "boolean" },
                tt_days: { type: "number" },
              },
            },
          },
          required: ["rate_id", "updates"],
        },
      },
      {
        name: "create_freight_rate",
        description: "Create a new ocean freight rate",
        inputSchema: {
          type: "object",
          properties: {
            vendor_id: { type: "number" },
            contract_id: { type: "number" },
            pol_code: { type: "string", description: "Port of Loading UN/LOCODE" },
            pod_code: { type: "string", description: "Port of Discharge UN/LOCODE" },
            container_type: { type: "string" },
            buy_amount: { type: "number" },
            currency: { type: "string", default: "USD" },
            tt_days: { type: "number", description: "Transit time in days" },
            valid_from: { type: "string", format: "date" },
            valid_to: { type: "string", format: "date" },
            is_preferred: { type: "boolean", default: false },
          },
          required: ["vendor_id", "pol_code", "pod_code", "container_type", "buy_amount", "valid_from", "valid_to"],
        },
      },
      {
        name: "update_surcharge",
        description: "Update a surcharge amount or validity",
        inputSchema: {
          type: "object",
          properties: {
            surcharge_id: {
              type: "number",
              description: "Surcharge ID",
            },
            updates: {
              type: "object",
              description: "Fields to update",
              properties: {
                amount: { type: "number" },
                valid_from: { type: "string", format: "date" },
                valid_to: { type: "string", format: "date" },
              },
            },
          },
          required: ["surcharge_id", "updates"],
        },
      },
      {
        name: "create_surcharge",
        description: "Create a new surcharge",
        inputSchema: {
          type: "object",
          properties: {
            vendor_id: { type: "number" },
            contract_id: { type: "number" },
            charge_code: { type: "string", description: "Charge code (e.g., 'THC', 'BAF')" },
            amount: { type: "number" },
            currency: { type: "string", default: "USD" },
            uom: { type: "string", description: "Unit of measure (e.g., 'per_container')" },
            pol_code: { type: "string", description: "Optional - specific POL" },
            pod_code: { type: "string", description: "Optional - specific POD" },
            container_type: { type: "string", description: "Optional - specific container type" },
            valid_from: { type: "string", format: "date" },
            valid_to: { type: "string", format: "date" },
          },
          required: ["vendor_id", "charge_code", "amount", "valid_from", "valid_to"],
        },
      },
      {
        name: "update_location",
        description: "Update location details (port/ICD information)",
        inputSchema: {
          type: "object",
          properties: {
            location_id: {
              type: "string",
              description: "Location UUID",
            },
            updates: {
              type: "object",
              description: "Fields to update",
              properties: {
                name: { type: "string" },
                unlocode: { type: "string" },
                country_code: { type: "string" },
                location_type: { type: "string" },
                is_gateway_port: { type: "boolean" },
              },
            },
          },
          required: ["location_id", "updates"],
        },
      },
      {
        name: "create_location",
        description: "Create a new location (port/ICD)",
        inputSchema: {
          type: "object",
          properties: {
            unlocode: { type: "string", description: "UN/LOCODE (5 chars)" },
            name: { type: "string" },
            country_code: { type: "string", description: "2-letter country code" },
            location_type: { 
              type: "string", 
              enum: ["SEAPORT", "ICD", "CFS", "AIRPORT"],
              description: "Type of location" 
            },
            parent_port_id: { type: "string", description: "UUID of parent seaport (for ICDs)" },
            is_gateway_port: { type: "boolean", default: false },
          },
          required: ["unlocode", "name", "country_code", "location_type"],
        },
      },
      {
        name: "list_vendors",
        description: "List all vendors with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            vendor_type: {
              type: "string",
              description: "Filter by type (e.g., 'ocean_carrier', 'forwarder')",
            },
            is_active: {
              type: "boolean",
              description: "Filter by active status",
              default: true,
            },
          },
        },
      },
      {
        name: "update_vendor",
        description: "Update vendor information",
        inputSchema: {
          type: "object",
          properties: {
            vendor_id: { type: "number" },
            updates: {
              type: "object",
              properties: {
                name: { type: "string" },
                alias: { type: "string" },
                type: { type: "string" },
              },
            },
          },
          required: ["vendor_id", "updates"],
        },
      },

      // ==========================================
      // 3. MARGIN RULES
      // ==========================================
      {
        name: "create_margin_rule",
        description: "Create a new margin rule (global, trade zone, or port pair specific)",
        inputSchema: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["global", "trade_zone", "port_pair"],
              description: "Rule scope level",
            },
            scope_ref: {
              type: "string",
              description: "Reference value (trade zone code or 'POL-POD' for port pair, null for global)",
            },
            mark_kind: {
              type: "string",
              enum: ["pct", "flat"],
              description: "Margin type: percentage or flat amount",
            },
            mark_value: {
              type: "number",
              description: "Margin value (e.g., 15 for 15% or 500 for $500 flat)",
            },
            priority: {
              type: "number",
              description: "Priority (higher = applied first)",
              default: 100,
            },
          },
          required: ["scope", "mark_kind", "mark_value"],
        },
      },
      {
        name: "update_margin_rule",
        description: "Update an existing margin rule",
        inputSchema: {
          type: "object",
          properties: {
            rule_id: {
              type: "number",
              description: "Margin rule ID",
            },
            updates: {
              type: "object",
              description: "Fields to update",
              properties: {
                mark_value: { type: "number" },
                priority: { type: "number" },
                is_active: { type: "boolean" },
              },
            },
          },
          required: ["rule_id", "updates"],
        },
      },
      {
        name: "delete_margin_rule",
        description: "Delete a margin rule",
        inputSchema: {
          type: "object",
          properties: {
            rule_id: {
              type: "number",
              description: "Margin rule ID to delete",
            },
          },
          required: ["rule_id"],
        },
      },
      {
        name: "list_margin_rules",
        description: "List all margin rules with optional filtering",
        inputSchema: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["global", "trade_zone", "port_pair"],
              description: "Filter by scope",
            },
            is_active: {
              type: "boolean",
              description: "Filter by active status",
            },
          },
        },
      },

      // ==========================================
      // 4. CREATE QUOTATION
      // ==========================================
      {
        name: "create_quotation",
        description: "Create a complete quotation from pricing data. Generates quote with all line items.",
        inputSchema: {
          type: "object",
          properties: {
            customer_name: {
              type: "string",
              description: "Customer name",
            },
            salesforce_opportunity_id: {
              type: "string",
              description: "Salesforce Opportunity ID (external reference)",
            },
            pol_code: {
              type: "string",
              description: "Port of Loading UN/LOCODE",
            },
            pod_code: {
              type: "string",
              description: "Port of Discharge UN/LOCODE",
            },
            container_type: {
              type: "string",
              description: "Container type",
            },
            container_count: {
              type: "number",
              description: "Number of containers",
              default: 1,
            },
            pricing_data: {
              type: "object",
              description: "Pricing breakdown from price_enquiry",
            },
            valid_until: {
              type: "string",
              format: "date",
              description: "Quote validity date",
            },
          },
          required: ["customer_name", "pol_code", "pod_code", "container_type", "pricing_data"],
        },
      },
      {
        name: "get_quotation",
        description: "Retrieve a quotation by ID",
        inputSchema: {
          type: "object",
          properties: {
            quote_id: {
              type: "string",
              description: "Quote UUID or quote number",
            },
          },
          required: ["quote_id"],
        },
      },

      // ==========================================
      // HELPER TOOLS
      // ==========================================
      {
        name: "search_locations",
        description: "Search for ports/ICDs by name or code",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Search term (name or UN/LOCODE)",
            },
            location_type: {
              type: "string",
              description: "Filter by type (SEAPORT, ICD, etc.)",
            },
            country_code: {
              type: "string",
              description: "Filter by country code",
            },
            limit: {
              type: "number",
              default: 20,
              description: "Number of results",
            },
          },
          required: ["search"],
        },
      },
      {
        name: "list_charge_codes",
        description: "List all available charge codes with descriptions",
        inputSchema: {
          type: "object",
          properties: {
            bucket: {
              type: "string",
              description: "Filter by bucket (freight, origin, destination, etc.)",
            },
          },
        },
      },

      // ==========================================
      // 5. INLAND HAULAGE
      // ==========================================
      {
        name: "get_inland_haulage",
        description: "Get inland haulage charges (IHE/IHI) for routes involving inland ports. Use this for inland container depots (ICD) to calculate haulage from/to gateway ports.",
        inputSchema: {
          type: "object",
          properties: {
            pol_code: {
              type: "string",
              description: "Port of Loading (can be inland like INTKD)",
            },
            pod_code: {
              type: "string", 
              description: "Port of Discharge (can be inland)",
            },
            container_type: {
              type: "string",
              description: "Container type (e.g., 40HC, 20GP)",
            },
            container_count: {
              type: "number",
              description: "Number of containers (default: 1)",
              default: 1,
            },
            cargo_weight_mt: {
              type: "number",
              description: "Cargo weight in metric tons (required for haulage calculation)",
            },
            haulage_type: {
              type: "string",
              enum: ["carrier", "merchant"],
              description: "Haulage responsibility - 'carrier' for IHE/IHI charges, 'merchant' for no charges",
            },
          },
          required: ["pol_code", "pod_code", "container_type", "cargo_weight_mt", "haulage_type"],
        },
      },

      // ==========================================
      // 6. VESSEL SCHEDULES
      // ==========================================
      {
        name: "search_schedules",
        description: "Search for vessel schedules between origin and destination ports. Returns schedules from multiple sources (database, Portcast, carrier APIs) with route details including legs for indirect routes.",
        inputSchema: {
          type: "object",
          properties: {
            origin: {
              type: "string",
              description: "Origin port UN/LOCODE (e.g., 'INNSA', 'CNSHA')",
            },
            destination: {
              type: "string",
              description: "Destination port UN/LOCODE (optional, e.g., 'NLRTM', 'USNYC')",
            },
            departure_from: {
              type: "string",
              format: "date",
              description: "Start date for departure range (YYYY-MM-DD, defaults to today)",
            },
            departure_to: {
              type: "string",
              format: "date",
              description: "End date for departure range (YYYY-MM-DD, optional)",
            },
            weeks: {
              type: "number",
              description: "Number of weeks from departure_from (2, 4, or 6) - calculates departure_to automatically",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 100, max: 500)",
              default: 100,
            },
          },
          required: ["origin"],
        },
      },
      {
        name: "get_schedule_metrics",
        description: "Get statistics on schedule data sources for a specific search. Returns counts and percentages for Database, Portcast, and Line API (Maersk) sources.",
        inputSchema: {
          type: "object",
          properties: {
            origin: {
              type: "string",
              description: "Origin port UN/LOCODE",
            },
            destination: {
              type: "string",
              description: "Destination port UN/LOCODE (optional)",
            },
            departure_from: {
              type: "string",
              format: "date",
              description: "Start date for departure range (YYYY-MM-DD)",
            },
            departure_to: {
              type: "string",
              format: "date",
              description: "End date for departure range (YYYY-MM-DD, optional)",
            },
            weeks: {
              type: "number",
              description: "Number of weeks from departure_from (2, 4, or 6)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to analyze (default: 100)",
              default: 100,
            },
          },
          required: ["origin"],
        },
      },
      {
        name: "get_schedule_audit_stats",
        description: "Get historical statistics on schedule data sources from the audit table. Shows where schedules were ingested from (database, Portcast, line API).",
        inputSchema: {
          type: "object",
          properties: {
            carrier: {
              type: "string",
              description: "Filter by carrier name (optional)",
            },
            start_date: {
              type: "string",
              format: "date",
              description: "Filter from this date (YYYY-MM-DD, optional)",
            },
            end_date: {
              type: "string",
              format: "date",
              description: "Filter until this date (YYYY-MM-DD, optional)",
            },
            limit: {
              type: "number",
              description: "Maximum records to analyze (default: 1000, max: 10000)",
              default: 1000,
            },
          },
        },
      },
      {
        name: "get_carrier_schedule_breakdown",
        description: "Get a breakdown of schedule sources grouped by carrier. Shows which carriers have data from which sources (database, Portcast, line API).",
        inputSchema: {
          type: "object",
          properties: {
            start_date: {
              type: "string",
              format: "date",
              description: "Filter from this date (YYYY-MM-DD, optional)",
            },
            end_date: {
              type: "string",
              format: "date",
              description: "Filter until this date (YYYY-MM-DD, optional)",
            },
          },
        },
      },
      {
        name: "list_carriers",
        description: "List all carriers/vendors available in the system. Useful for schedule searches and filtering.",
        inputSchema: {
          type: "object",
          properties: {
            is_active: {
              type: "boolean",
              description: "Filter by active status (optional)",
              default: true,
            },
          },
        },
      },
      {
        name: "list_services",
        description: "List carrier services (routes) available in the system. Shows service codes and names for each carrier.",
        inputSchema: {
          type: "object",
          properties: {
            carrier: {
              type: "string",
              description: "Filter by carrier name (optional)",
            },
          },
        },
      },
    ],
  };
});

// ============================================
// TOOL IMPLEMENTATIONS
// ============================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Set tenant context for MCP tools (use default tenant for MCP)
    await supabase.rpc('set_tenant_context', {
      tenant_id: '00000000-0000-0000-0000-000000000001',
      user_id: 'mcp_user'
    });

    // ==========================================
    // 1. PRICING ENQUIRIES
    // ==========================================
    
    if (name === "price_enquiry") {
      try {
      const { pol_code, pod_code, container_type, container_count = 1 } = args as any;

        console.error(`[price_enquiry] Starting with: ${pol_code} → ${pod_code}, ${container_type}`);

        // Use the same approach as the working HTTP API - query mv_freight_sell_prices
        const { data: rateData, error: rateError } = await supabase
          .from('mv_freight_sell_prices')
          .select('*')
          .eq('pol_code', pol_code)
          .eq('pod_code', pod_code)
          .eq('container_type', container_type)
          .eq('is_preferred', true)
        .single();

        console.error(`[price_enquiry] Rate query result:`, { rateData: !!rateData, rateError });

        if (rateError && rateError.code !== 'PGRST116') {
          throw new Error(`Rate query failed: ${rateError.message}`);
        }

        if (!rateData) {
        return {
          content: [{
            type: "text",
              text: `No preferred rate found for ${pol_code} → ${pod_code}, ${container_type}`,
          }],
          isError: true,
        };
      }

        // Get local charges using the same logic as HTTP API
        const contractId = rateData.contract_id;
        const polId = rateData.pol_id;
        const podId = rateData.pod_id;
        const vendorId = rateData.vendor_id;

        console.error(`[price_enquiry] Contract/Port/Vendor IDs:`, { contractId, polId, podId, vendorId });

        // Get Origin Charges - filter by vendor to reduce duplicates
        const { data: originChargesRaw, error: originError } = await supabase
          .from('v_local_charges_details')
        .select('*')
          .eq('contract_id', contractId)
          .eq('pol_id', polId)
          .eq('vendor_id', vendorId)
          .eq('charge_location_type', 'Origin Charges')
          .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

        console.error(`[price_enquiry] Origin charges raw:`, { count: originChargesRaw?.length, error: originError });

        // Get Destination Charges - filter by vendor to reduce duplicates
        const { data: destChargesRaw, error: destError } = await supabase
          .from('v_local_charges_details')
          .select('*')
          .eq('contract_id', contractId)
          .eq('pod_id', podId)
          .eq('vendor_id', vendorId)
          .eq('charge_location_type', 'Destination Charges')
          .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

        console.error(`[price_enquiry] Destination charges raw:`, { count: destChargesRaw?.length, error: destError });

        // Deduplicate charges by charge_code (take first occurrence only)
        const deduplicateCharges = (charges: any[]) => {
          const seen = new Set();
          return charges?.filter((charge: any) => {
            if (seen.has(charge.charge_code)) {
              return false;
            }
            seen.add(charge.charge_code);
            return true;
          }) || [];
        };

        const originCharges = deduplicateCharges(originChargesRaw || []);
        const destCharges = deduplicateCharges(destChargesRaw || []);

        console.error(`[price_enquiry] After deduplication:`, { 
          origin_count: originCharges?.length, 
          dest_count: destCharges?.length 
        });

        // Get FX rates for currency conversion
        const currencies = [...new Set([
          ...(originCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
          ...(destCharges?.map((c: any) => c.charge_currency).filter(Boolean) || [])
        ])].filter(c => c !== 'USD');

        let fxRates: { [key: string]: number } = {};
        if (currencies.length > 0) {
          const { data: fxData, error: fxError } = await supabase
            .from('fx_rate')
            .select('rate_date, base_ccy, quote_ccy, rate')
            .eq('quote_ccy', 'USD')
            .in('base_ccy', currencies)
            .lte('rate_date', new Date().toISOString().split('T')[0])
            .order('rate_date', { ascending: false });

          if (fxData && fxData.length > 0) {
            // Group by currency and take the latest rate for each
            const latestRates: { [key: string]: any } = {};
            fxData.forEach((fx: any) => {
              if (!latestRates[fx.base_ccy]) {
                latestRates[fx.base_ccy] = fx;
              }
            });
            
            Object.values(latestRates).forEach((fx: any) => {
              fxRates[fx.base_ccy] = fx.rate;
            });
          }
        }

        // Helper function to convert currency to USD with fallback rates
        const convertToUSD = (amount: number, currency: string) => {
          if (!amount || currency === 'USD') return amount;
          
          // Try to use database FX rate first
          if (fxRates[currency]) {
            return Math.round(amount * fxRates[currency] * 100) / 100;
          }
          
          // Fallback rates (how many USD per 1 unit of foreign currency)
          const fallbackRates: { [key: string]: number } = {
            'INR': 1/83.0,   // 1 INR = ~0.012 USD
            'EUR': 1/0.85,   // 1 EUR = ~1.176 USD
            'AED': 1/3.67,   // 1 AED = ~0.272 USD
            'GBP': 1/0.73,   // 1 GBP = ~1.370 USD
            'JPY': 1/110.0,  // 1 JPY = ~0.009 USD
            'CNY': 1/7.2,    // 1 CNY = ~0.139 USD
          };
          
          const rate = fallbackRates[currency] || 1;
          return Math.round(amount * rate * 100) / 100;
        };

        // Calculate totals with currency conversion
        const oceanFreightSell = rateData.all_in_freight_sell || 0;
        const originTotalUSD = originCharges?.reduce((sum: number, charge: any) => sum + convertToUSD(charge.charge_amount || 0, charge.charge_currency), 0) || 0;
        const destTotalUSD = destCharges?.reduce((sum: number, charge: any) => sum + convertToUSD(charge.charge_amount || 0, charge.charge_currency), 0) || 0;
        
        const totalPerContainer = oceanFreightSell + originTotalUSD + destTotalUSD;
        const grandTotal = totalPerContainer * container_count;

      const result = {
        route: {
          pol: pol_code,
          pod: pod_code,
          container_type: container_type,
          container_count: container_count,
        },
          vendor: rateData.carrier || 'N/A',
          transit_days: rateData.transit_days || 0,
        pricing: {
            ocean_freight: {
              buy: rateData.ocean_freight_buy || 0,
              sell: oceanFreightSell,
              surcharges: rateData.freight_surcharges || 0,
              margin: {
                type: rateData.margin_type || 'N/A',
                percentage: rateData.margin_percentage || 0,
                amount: rateData.margin_amount || 0,
              },
              currency: rateData.currency || 'USD',
            },
            local_charges: {
              origin_total: originTotalUSD,
              destination_total: destTotalUSD,
              origin_charges: originCharges?.map((c: any) => ({
                charge_name: c.vendor_charge_name,
                charge_code: c.charge_code,
                amount: c.charge_amount,
                currency: c.charge_currency,
                amount_usd: convertToUSD(c.charge_amount, c.charge_currency),
        })) || [],
              destination_charges: destCharges?.map((c: any) => ({
                charge_name: c.vendor_charge_name,
                charge_code: c.charge_code,
                amount: c.charge_amount,
                currency: c.charge_currency,
                amount_usd: convertToUSD(c.charge_amount, c.charge_currency),
              })) || [],
            },
            totals: {
              per_container: totalPerContainer,
              grand_total: grandTotal,
              currency: 'USD',
            },
          },
          validity: {
            from: rateData.valid_from,
            to: rateData.valid_to,
          },
          rate_id: rateData.rate_id,
        };

        console.error(`[price_enquiry] Success - returning result`);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
      } catch (priceError) {
        console.error(`[price_enquiry] Error:`, priceError);
        throw new Error(`Price enquiry failed: ${priceError instanceof Error ? priceError.message : String(priceError)}`);
      }
    }

    if (name === "search_rates") {
      const { pol_code, pod_code, container_type, vendor_name } = args as any;

      let query = supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('pol_code', pol_code)
        .eq('pod_code', pod_code);

      if (container_type) {
        query = query.eq('container_type', container_type);
      }

      if (vendor_name) {
        query = query.ilike('carrier', `%${vendor_name}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Format the response nicely
      // Helper to strip UN/LOCODE or similar codes in parentheses from names
      const stripCode = (s: any) => String(s || '').replace(/\s*\([A-Z0-9]{3,6}\)/g, '');

      const formattedData = data?.map(rate => ({
        vendor: rate.carrier,
        // Display only location names; strip any code-in-parentheses to avoid duplication
        route: `${stripCode(rate.pol_name)} → ${stripCode(rate.pod_name)}`,
        container_type: rate.container_type,
        transit_days: rate.transit_days,
        pricing: {
          ocean_freight_buy: rate.ocean_freight_buy,
          freight_surcharges: rate.freight_surcharges,
          all_in_freight_buy: rate.all_in_freight_buy,
          margin: {
            type: rate.margin_type,
            percentage: rate.margin_percentage,
            amount: rate.margin_amount,
          },
          all_in_freight_sell: rate.all_in_freight_sell,
          currency: rate.currency,
        },
        validity: {
          from: rate.valid_from,
          to: rate.valid_to,
        },
        is_preferred: rate.is_preferred,
        rate_id: rate.rate_id,
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(formattedData, null, 2),
        }],
      };
    }

    if (name === "get_surcharges") {
      const { pol_code, pod_code, container_type, vendor_id } = args as any;

      // Use the same approach as HTTP API - query v_local_charges_details
      let originQuery = supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('origin_port_code', pol_code)
        .eq('applies_scope', 'origin');

      let destQuery = supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('destination_port_code', pod_code)
        .eq('applies_scope', 'dest');

      if (container_type) {
        originQuery = originQuery.or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);
        destQuery = destQuery.or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);
      }

      if (vendor_id) {
        originQuery = originQuery.eq('vendor_id', vendor_id);
        destQuery = destQuery.eq('vendor_id', vendor_id);
      }

      const { data: originCharges, error: originError } = await originQuery;
      const { data: destCharges, error: destError } = await destQuery;

      if (originError) throw originError;
      if (destError) throw destError;

      const result = {
        origin_charges: originCharges?.map((c: any) => ({
          charge_name: c.vendor_charge_name,
          charge_code: c.charge_code,
          amount: c.charge_amount,
          currency: c.charge_currency,
          uom: c.uom,
          vendor_name: c.vendor_name,
          port_code: c.origin_port_code,
          port_name: c.origin_port_name,
        })) || [],
        destination_charges: destCharges?.map((c: any) => ({
          charge_name: c.vendor_charge_name,
          charge_code: c.charge_code,
          amount: c.charge_amount,
          currency: c.charge_currency,
          uom: c.uom,
          vendor_name: c.vendor_name,
          port_code: c.destination_port_code,
          port_name: c.destination_port_name,
        })) || [],
        summary: {
          pol_code,
          pod_code,
          container_type,
          origin_count: originCharges?.length || 0,
          destination_count: destCharges?.length || 0,
        },
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    }

    if (name === "get_inland_haulage") {
      try {
        const { pol_code, pod_code, container_type, container_count = 1, cargo_weight_mt, haulage_type } = args as any;

        // Call the simplified inland function for IHE/IHI only
        const { data: result, error } = await supabase.rpc('simplified_inland_function', {
          p_pol_code: pol_code,
          p_pod_code: pod_code,
          p_container_type: container_type,
          p_container_count: container_count,
          p_cargo_weight_mt: cargo_weight_mt,
          p_haulage_type: haulage_type
        });

        if (error) {
          throw new Error(`Inland haulage error: ${error.message}`);
        }

        if (!result || !result.success) {
          throw new Error(result?.error_message || 'Inland haulage function failed');
        }

        const response = {
          pol_code,
          pod_code,
          pol_is_inland: result.pol_is_inland,
          pod_is_inland: result.pod_is_inland,
          container_type,
          container_count,
          haulage_type,
          ihe_charges: result.ihe_charges,
          ihi_charges: result.ihi_charges,
          total_haulage_usd: (result.ihe_charges?.total_amount_usd || 0) + (result.ihi_charges?.total_amount_usd || 0),
          exchange_rate: result.exchange_rate,
          metadata: {
            generated_at: new Date().toISOString(),
            api_version: 'v3',
            endpoint: 'get-inland-haulage'
          }
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2),
          }],
        };
      } catch (haulageError) {
        throw new Error(`Get inland haulage failed: ${haulageError instanceof Error ? haulageError.message : String(haulageError)}`);
      }
    }

    // ==========================================
    // 2. UPDATE RATES & DATA
    // ==========================================

    if (name === "update_freight_rate") {
      const { rate_id, updates } = args as any;

      const { data, error } = await supabase
        .from('ocean_freight_rate')
        .update(updates)
        .eq('id', rate_id)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ Freight rate ${rate_id} updated successfully\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "create_freight_rate") {
      const { pol_code, pod_code, ...rateData } = args as any;

      // Get location IDs
      const { data: polData } = await supabase
        .from('location')
        .select('id')
        .eq('unlocode', pol_code)
        .single();

      const { data: podData } = await supabase
        .from('location')
        .select('id')
        .eq('unlocode', pod_code)
        .single();

      if (!polData || !podData) {
        throw new Error(`Locations not found: ${pol_code} or ${pod_code}`);
      }

      const { data, error } = await supabase
        .from('ocean_freight_rate')
        .insert({
          ...rateData,
          pol_id: polData.id,
          pod_id: podData.id,
        })
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ New freight rate created\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "update_surcharge") {
      const { surcharge_id, updates } = args as any;

      const { data, error } = await supabase
        .from('surcharge')
        .update(updates)
        .eq('id', surcharge_id)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ Surcharge ${surcharge_id} updated successfully\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "create_surcharge") {
      const { pol_code, pod_code, ...surchargeData } = args as any;

      let insertData: any = { ...surchargeData };

      // Get location IDs if specified
      if (pol_code) {
        const { data: polData } = await supabase
          .from('location')
          .select('id')
          .eq('unlocode', pol_code)
          .single();
        if (polData) insertData.pol_id = polData.id;
      }

      if (pod_code) {
        const { data: podData } = await supabase
          .from('location')
          .select('id')
          .eq('unlocode', pod_code)
          .single();
        if (podData) insertData.pod_id = podData.id;
      }

      const { data, error } = await supabase
        .from('surcharge')
        .insert(insertData)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ New surcharge created\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "update_location") {
      const { location_id, updates } = args as any;

      const { data, error } = await supabase
        .from('location')
        .update(updates)
        .eq('id', location_id)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ Location updated successfully\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "create_location") {
      const { data, error } = await supabase
        .from('location')
        .insert(args)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ New location created\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "list_vendors") {
      const { vendor_type, is_active } = args as any;

      let query = supabase.from('vendor').select('*');

      if (vendor_type) {
        query = query.eq('type', vendor_type);
      }

      if (is_active !== undefined) {
        query = query.eq('is_active', is_active);
      }

      const { data, error } = await query;
      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2),
        }],
      };
    }

    if (name === "update_vendor") {
      const { vendor_id, updates } = args as any;

      const { data, error } = await supabase
        .from('vendor')
        .update(updates)
        .eq('id', vendor_id)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ Vendor updated successfully\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    // ==========================================
    // 3. MARGIN RULES
    // ==========================================

    if (name === "create_margin_rule") {
      const { data, error } = await supabase
        .from('margin_rule_v2')
        .insert(args)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ Margin rule created successfully\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "update_margin_rule") {
      const { rule_id, updates } = args as any;

      const { data, error } = await supabase
        .from('margin_rule_v2')
        .update(updates)
        .eq('id', rule_id)
        .select();

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ Margin rule updated successfully\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    if (name === "delete_margin_rule") {
      const { rule_id } = args as any;

      const { error } = await supabase
        .from('margin_rule_v2')
        .delete()
        .eq('id', rule_id);

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: `✅ Margin rule ${rule_id} deleted successfully`,
        }],
      };
    }

    if (name === "list_margin_rules") {
      const { scope, is_active } = args as any;

      let query = supabase.from('margin_rule_v2').select('*');

      if (scope) {
        query = query.eq('scope', scope);
      }

      if (is_active !== undefined) {
        query = query.eq('is_active', is_active);
      }

      query = query.order('priority', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2),
        }],
      };
    }

    // ==========================================
    // 4. CREATE QUOTATION
    // ==========================================

    if (name === "create_quotation") {
      const typedArgs = args as any;
      // For now, return the structured quote data
      // You can store this in a quotes table if you have one
      const quote = {
        quote_number: `QT-${Date.now()}`,
        customer_name: typedArgs.customer_name,
        salesforce_opportunity_id: typedArgs.salesforce_opportunity_id,
        route: {
          pol: typedArgs.pol_code,
          pod: typedArgs.pod_code,
          container_type: typedArgs.container_type,
          container_count: typedArgs.container_count,
        },
        pricing: typedArgs.pricing_data,
        valid_until: typedArgs.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        status: 'draft',
      };

      return {
        content: [{
          type: "text",
          text: `✅ Quotation created successfully\n${JSON.stringify(quote, null, 2)}`,
        }],
      };
    }

    if (name === "get_quotation") {
      const { quote_id } = args as any;

      // If you have a quotes table, query it here
      // For now, return a mock response
      return {
        content: [{
          type: "text",
          text: `Quote ${quote_id} - This would retrieve from quotes table`,
        }],
      };
    }

    // ==========================================
    // HELPER TOOLS
    // ==========================================

    if (name === "search_locations") {
      const { search, location_type, country_code, limit = 20 } = args as any;

      let query = supabase
        .from('location')
        .select('*')
        .or(`name.ilike.%${search}%,unlocode.ilike.%${search}%`)
        .limit(limit);

      if (location_type) {
        query = query.eq('location_type', location_type);
      }

      if (country_code) {
        query = query.eq('country_code', country_code);
      }

      const { data, error } = await query;
      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2),
        }],
      };
    }

    if (name === "list_charge_codes") {
      const { bucket } = args as any;

      let query = supabase.from('charge_master').select('*');

      if (bucket) {
        query = query.eq('bucket', bucket);
      }

      const { data, error } = await query;
      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2),
        }],
      };
    }

    // ==========================================
    // 6. VESSEL SCHEDULES
    // ==========================================

    if (name === "search_schedules") {
      const { origin, destination, departure_from, departure_to, weeks, limit = 100 } = args as any;

      if (!origin) {
        throw new Error('origin is required');
      }

      // Import schedule service
      const { ScheduleIntegrationService } = await import('./services/schedule-integration.service.js');
      const scheduleService = new ScheduleIntegrationService(supabase);

      // Parse dates
      let departureFromISO: string | undefined = departure_from;
      let departureToISO: string | undefined = departure_to;

      if (weeks !== undefined && departureFromISO) {
        const weeksNum = Number(weeks);
        if (!Number.isNaN(weeksNum) && weeksNum > 0) {
          const fromDate = new Date(`${departureFromISO}T00:00:00Z`);
          fromDate.setDate(fromDate.getDate() + (weeksNum * 7));
          departureToISO = fromDate.toISOString().split('T')[0];
        }
      }

      if (!departureFromISO) {
        departureFromISO = new Date().toISOString().split('T')[0];
      }

      const numericLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

      // Search schedules
      const schedules = await scheduleService.searchSchedules(origin, {
        destination,
        departureFrom: departureFromISO,
        departureTo: departureToISO,
        limit: numericLimit,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            total_results: schedules.length,
            schedules: schedules,
            metadata: {
              origin: origin.toUpperCase(),
              destination: destination ? destination.toUpperCase() : undefined,
              departure_from: departureFromISO,
              departure_to: departureToISO,
              limit: numericLimit
            }
          }, null, 2),
        }],
      };
    }

    if (name === "get_schedule_metrics") {
      const { origin, destination, departure_from, departure_to, weeks, limit = 100 } = args as any;

      if (!origin) {
        throw new Error('origin is required');
      }

      // Import schedule service
      const { ScheduleIntegrationService } = await import('./services/schedule-integration.service.js');
      const scheduleService = new ScheduleIntegrationService(supabase);

      // Parse dates
      let departureFromISO: string | undefined = departure_from;
      let departureToISO: string | undefined = departure_to;

      if (weeks !== undefined && departureFromISO) {
        const weeksNum = Number(weeks);
        if (!Number.isNaN(weeksNum) && weeksNum > 0) {
          const fromDate = new Date(`${departureFromISO}T00:00:00Z`);
          fromDate.setDate(fromDate.getDate() + (weeksNum * 7));
          departureToISO = fromDate.toISOString().split('T')[0];
        }
      }

      if (!departureFromISO) {
        departureFromISO = new Date().toISOString().split('T')[0];
      }

      const numericLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

      // Get schedules
      const schedules = await scheduleService.searchSchedules(origin, {
        destination,
        departureFrom: departureFromISO,
        departureTo: departureToISO,
        limit: numericLimit,
      });

      // Count by source
      const sourceStats = {
        database: 0,
        portcast: 0,
        maersk: 0,
        unknown: 0,
        total: schedules.length
      };

      for (const schedule of schedules) {
        switch (schedule.source?.toLowerCase()) {
          case 'database':
            sourceStats.database++;
            break;
          case 'portcast':
            sourceStats.portcast++;
            break;
          case 'maersk':
            sourceStats.maersk++;
            break;
          default:
            sourceStats.unknown++;
        }
      }

      // Calculate percentages
      const percentages = {
        database: sourceStats.total > 0 ? (sourceStats.database / sourceStats.total * 100).toFixed(2) : '0.00',
        portcast: sourceStats.total > 0 ? (sourceStats.portcast / sourceStats.total * 100).toFixed(2) : '0.00',
        maersk: sourceStats.total > 0 ? (sourceStats.maersk / sourceStats.total * 100).toFixed(2) : '0.00',
        unknown: sourceStats.total > 0 ? (sourceStats.unknown / sourceStats.total * 100).toFixed(2) : '0.00'
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            counts: sourceStats,
            percentages,
            breakdown: {
              from_database: sourceStats.database,
              from_line_api: sourceStats.maersk,
              from_portcast: sourceStats.portcast,
              unknown_source: sourceStats.unknown,
              total_schedules: sourceStats.total
            },
            metadata: {
              origin: origin.toUpperCase(),
              destination: destination ? destination.toUpperCase() : undefined,
              departure_from: departureFromISO,
              departure_to: departureToISO,
              limit: numericLimit
            }
          }, null, 2),
        }],
      };
    }

    if (name === "get_schedule_audit_stats") {
      const { carrier, start_date, end_date, limit = 1000 } = args as any;

      let query = supabase
        .from('schedule_source_audit')
        .select('source_system, carrier_id, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(limit) || 1000, 10000));

      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data: auditRecords, error } = await query;

      if (error) throw error;

      // Get carrier names if carrier filter provided
      let carrierIds: string[] | null = null;
      if (carrier) {
        const { data: carriers } = await supabase
          .from('carrier')
          .select('id')
          .ilike('name', `%${carrier}%`);
        
        carrierIds = carriers?.map(c => c.id) || [];
        if (carrierIds.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                counts: { database: 0, portcast: 0, maersk: 0, unknown: 0, total: 0 },
                percentages: { database: '0.00', portcast: '0.00', maersk: '0.00', unknown: '0.00' },
                breakdown: {
                  from_database: 0,
                  from_line_api: 0,
                  from_portcast: 0,
                  unknown_source: 0,
                  total_schedules: 0
                },
                message: `No records found for carrier: ${carrier}`
              }, null, 2),
            }],
          };
        }
      }

      // Filter by carrier if specified
      const filteredRecords = carrierIds 
        ? (auditRecords || []).filter((record: any) => carrierIds!.includes(record.carrier_id))
        : (auditRecords || []);

      // Count by source
      const sourceStats = {
        database: 0,
        portcast: 0,
        maersk: 0,
        unknown: 0,
        total: filteredRecords.length
      };

      for (const record of filteredRecords) {
        const source = (record.source_system || '').toLowerCase();
        switch (source) {
          case 'database':
          case 'db':
            sourceStats.database++;
            break;
          case 'portcast':
            sourceStats.portcast++;
            break;
          case 'maersk':
          case 'dcsa':
            sourceStats.maersk++;
            break;
          default:
            sourceStats.unknown++;
        }
      }

      // Calculate percentages
      const percentages = {
        database: sourceStats.total > 0 ? (sourceStats.database / sourceStats.total * 100).toFixed(2) : '0.00',
        portcast: sourceStats.total > 0 ? (sourceStats.portcast / sourceStats.total * 100).toFixed(2) : '0.00',
        maersk: sourceStats.total > 0 ? (sourceStats.maersk / sourceStats.total * 100).toFixed(2) : '0.00',
        unknown: sourceStats.total > 0 ? (sourceStats.unknown / sourceStats.total * 100).toFixed(2) : '0.00'
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            counts: sourceStats,
            percentages,
            breakdown: {
              from_database: sourceStats.database,
              from_line_api: sourceStats.maersk,
              from_portcast: sourceStats.portcast,
              unknown_source: sourceStats.unknown,
              total_schedules: sourceStats.total
            },
            metadata: {
              filters: {
                carrier: carrier || 'all',
                start_date: start_date || 'all',
                end_date: end_date || 'all',
                record_limit: Number(limit)
              },
              note: 'Statistics based on schedule_source_audit table. This tracks schedule ingestion, not search results.'
            }
          }, null, 2),
        }],
      };
    }

    if (name === "get_carrier_schedule_breakdown") {
      const { start_date, end_date } = args as any;

      let query = supabase
        .from('schedule_source_audit')
        .select('source_system, carrier_id')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data: auditRecords, error } = await query;

      if (error) throw error;

      // Get all unique carrier IDs
      const carrierIds = [...new Set((auditRecords || []).map((r: any) => r.carrier_id))];

      // Get carrier names
      const { data: carriers } = await supabase
        .from('carrier')
        .select('id, name')
        .in('id', carrierIds);

      const carrierMap = new Map(
        (carriers || []).map((c: any) => [c.id, c.name])
      );

      // Group by carrier and source
      const breakdown: Record<string, {
        carrier_name: string;
        database: number;
        portcast: number;
        maersk: number;
        unknown: number;
        total: number;
      }> = {};

      for (const record of (auditRecords || [])) {
        const carrierName = carrierMap.get(record.carrier_id) || 'Unknown Carrier';
        
        if (!breakdown[record.carrier_id]) {
          breakdown[record.carrier_id] = {
            carrier_name: carrierName,
            database: 0,
            portcast: 0,
            maersk: 0,
            unknown: 0,
            total: 0
          };
        }

        const source = (record.source_system || '').toLowerCase();
        switch (source) {
          case 'database':
          case 'db':
            breakdown[record.carrier_id].database++;
            break;
          case 'portcast':
            breakdown[record.carrier_id].portcast++;
            break;
          case 'maersk':
          case 'dcsa':
            breakdown[record.carrier_id].maersk++;
            break;
          default:
            breakdown[record.carrier_id].unknown++;
        }
        breakdown[record.carrier_id].total++;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            data: Object.values(breakdown).sort((a, b) => b.total - a.total),
            metadata: {
              filters: {
                start_date: start_date || 'all',
                end_date: end_date || 'all'
              }
            }
          }, null, 2),
        }],
      };
    }

    if (name === "list_carriers") {
      const { is_active } = args as any;

      let query = supabase.from('carrier').select('id, name, type');

      if (is_active !== undefined) {
        query = query.eq('is_active', is_active);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            carriers: data || [],
            count: data?.length || 0
          }, null, 2),
        }],
      };
    }

    if (name === "list_services") {
      const { carrier } = args as any;

      let query = supabase
        .from('service')
        .select('id, carrier_id, carrier_service_code, carrier_service_name, carrier:carrier_id(name)')
        .order('carrier_service_code', { ascending: true });

      if (carrier) {
        // First get carrier ID
        const { data: carrierData } = await supabase
          .from('carrier')
          .select('id')
          .ilike('name', `%${carrier}%`)
          .limit(1)
          .single();

        if (carrierData?.id) {
          query = query.eq('carrier_id', carrierData.id);
        } else {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                services: [],
                count: 0,
                message: `Carrier '${carrier}' not found`
              }, null, 2),
            }],
          };
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            services: data || [],
            count: data?.length || 0
          }, null, 2),
        }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    console.error(`MCP Tool Error [${name}]:`, error);
    return {
      content: [{
        type: "text",
        text: `Error in ${name}: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      }],
      isError: true,
    };
  }
});

// ============================================
// START SERVER
// ============================================

// ============================================
// TENANT & AUTH MIDDLEWARE
// ============================================

// Authentication middleware is now directly in createHttpServer function

// ============================================
// HTTP API SERVER (for n8n integration)
// ============================================

async function createHttpServer() {
  const fastify = Fastify({ logger: true });

  // Enable CORS for n8n
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // Add authentication middleware directly to fastify
  fastify.addHook('preHandler', async (request: any, reply: any) => {
    // Skip health check, auth endpoints, and webhook endpoints (they have their own auth)
    if (request.url === '/health' || 
        request.url === '/api/auth/token' ||
        request.url.startsWith('/api/dcsa/webhook') ||
        request.url.startsWith('/api/dcsa/sync') ||
        request.url.startsWith('/api/dcsa/discover-services')) return;

    // Only apply to /api routes
    if (!request.url.startsWith('/api/')) return;

    try {
      // 1. Extract and validate headers
      const authHeader = request.headers.authorization;
      const tenantHeader = request.headers['x-tenant-id'];

      if (!authHeader || !tenantHeader) {
        return reply.code(401).send({
          error: 'Missing required headers',
          required: ['authorization: Bearer <token>', 'x-tenant-id: <tenant_id>']
        });
      }

      // 2. Extract JWT token
      const token = authHeader.replace('Bearer ', '');
      
      // 3. Verify JWT and extract payload
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // 4. Validate tenant_id matches
      if (decoded.tenant_id !== tenantHeader) {
        return reply.code(403).send({
          error: 'Tenant ID mismatch',
          token_tenant: decoded.tenant_id,
          header_tenant: tenantHeader
        });
      }

      // 5. Set tenant context for Supabase RLS
      request.tenant_id = decoded.tenant_id;
      request.user_id = decoded.user_id;

      // 6. Set DB session variable for RLS
      await supabase.rpc('set_tenant_context', {
        tenant_id: decoded.tenant_id,
        user_id: decoded.user_id
      });

    } catch (error) {
      return reply.code(401).send({
        error: 'Invalid or expired token',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', service: 'rms-api', timestamp: new Date().toISOString() };
  });

  // JWT Token generation endpoint (for testing)
  fastify.post('/api/auth/token', async (request, reply) => {
    const { tenant_id, user_id } = request.body as any;
    
    if (!tenant_id) {
      return reply.code(400).send({ error: 'tenant_id is required' });
    }

    const token = jwt.sign({
      tenant_id,
      user_id: user_id || 'test-user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    }, JWT_SECRET);

    return {
      token,
      tenant_id,
      expires_in: '1h'
    };
  });

  // 1. Search Rates endpoint
  fastify.post('/api/search-rates', async (request, reply) => {
    try {
      const { pol_code, pod_code, container_type, vendor_name } = request.body as any;

      let query = supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('pol_code', pol_code)
        .eq('pod_code', pod_code);

      if (container_type) {
        query = query.eq('container_type', container_type);
      }

      if (vendor_name) {
        query = query.ilike('carrier', `%${vendor_name}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Format the response nicely (DB names already contain a single code in brackets)
      const formattedData = data?.map(rate => ({
        vendor: rate.carrier,
        route: `${rate.pol_name} → ${rate.pod_name}`,
        container_type: rate.container_type,
        transit_days: rate.transit_days,
        pricing: {
          ocean_freight_buy: rate.ocean_freight_buy,
          freight_surcharges: rate.freight_surcharges,
          all_in_freight_buy: rate.all_in_freight_buy,
          margin: {
            type: rate.margin_type,
            percentage: rate.margin_percentage,
            amount: rate.margin_amount,
          },
          all_in_freight_sell: rate.all_in_freight_sell,
          currency: rate.currency,
        },
        validity: {
          from: rate.valid_from,
          to: rate.valid_to,
        },
        is_preferred: rate.is_preferred,
        rate_id: rate.rate_id,
      }));

      return { success: true, data: formattedData };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // 2. Get Local Charges endpoint
  fastify.post('/api/get-local-charges', async (request, reply) => {
    try {
      const { pol_code, pod_code, container_type, vendor_name } = request.body as any;

      // At least one of pol_code or pod_code must be provided
      if (!pol_code && !pod_code) {
        reply.code(400);
        return { success: false, error: 'At least one of pol_code or pod_code must be provided' };
      }

      // Get origin charges (charges that apply at the origin port) - only if pol_code is provided
      let originCharges: any[] = [];
      if (pol_code) {
        let originQuery = supabase
          .from('v_local_charges_details')
          .select('*')
          .eq('origin_port_code', pol_code)
          .eq('applies_scope', 'origin');

        if (container_type) {
          originQuery = originQuery.or(`container_type.eq.${container_type},container_type.is.null`);
        }

        if (vendor_name) {
          originQuery = originQuery.ilike('vendor_name', `%${vendor_name}%`);
        }

        const { data, error: originError } = await originQuery;
        if (originError) throw originError;
        originCharges = data || [];
      }

      // Get destination charges (charges that apply at the destination port) - only if pod_code is provided
      let destCharges: any[] = [];
      if (pod_code) {
        let destQuery = supabase
          .from('v_local_charges_details')
          .select('*')
          .eq('destination_port_code', pod_code)
          .eq('applies_scope', 'dest');

        if (container_type) {
          destQuery = destQuery.or(`container_type.eq.${container_type},container_type.is.null`);
        }

        if (vendor_name) {
          destQuery = destQuery.ilike('vendor_name', `%${vendor_name}%`);
        }

        const { data, error: destError } = await destQuery;
        if (destError) throw destError;
        destCharges = data || [];
      }

      // Get FX rates for currency conversion
      const currencies = [...new Set([
        ...(originCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
        ...(destCharges?.map((c: any) => c.charge_currency).filter(Boolean) || [])
      ])].filter(c => c !== 'USD');

      let fxRates: { [key: string]: number } = {};
      if (currencies.length > 0) {
        const { data: fxData, error: fxError } = await supabase
          .from('fx_rate')
          .select('rate_date, base_ccy, quote_ccy, rate')
          .eq('quote_ccy', 'USD')
          .in('base_ccy', currencies)
          .lte('rate_date', new Date().toISOString().split('T')[0])
          .order('rate_date', { ascending: false });

        if (fxError) throw fxError;

        fxRates = fxData?.reduce((acc: { [key: string]: number }, fx: any) => {
          acc[fx.base_ccy] = fx.rate;
          return acc;
        }, {}) || {};
      }

      // Helper function to convert currency to USD with fallback rates
      const convertToUSD = (amount: number, currency: string) => {
        if (!amount || currency === 'USD') return amount;
        
        // Try to use database FX rate first
        if (fxRates[currency]) {
          return Math.round(amount * fxRates[currency] * 100) / 100;
        }
        
        // Fallback rates (how many USD per 1 unit of foreign currency)
        const fallbackRates: { [key: string]: number } = {
          'INR': 1/83.0,   // 1 INR = ~0.012 USD
          'EUR': 1/0.85,   // 1 EUR = ~1.176 USD
          'AED': 1/3.67,   // 1 AED = ~0.272 USD
          'GBP': 1/0.73,   // 1 GBP = ~1.370 USD
          'JPY': 1/110.0,  // 1 JPY = ~0.009 USD
          'CNY': 1/7.2,    // 1 CNY = ~0.139 USD
        };
        
        const rate = fallbackRates[currency] || 1;
        return Math.round(amount * rate * 100) / 100;
      };

      // Process charges with USD conversion - return only essential fields
      const processCharges = (charges: any[]) => {
        return charges?.map((charge: any) => ({
          charge_name: charge.vendor_charge_name,
          charge_code: charge.charge_code,
          applies_scope: charge.applies_scope,
          charge_amount: charge.charge_amount,
          charge_currency: charge.charge_currency,
          amount_usd: convertToUSD(charge.charge_amount, charge.charge_currency),
          uom: charge.uom,
          vendor_name: charge.vendor_name,
          port_code: charge.applies_scope === 'origin' ? charge.origin_port_code : charge.destination_port_code,
          port_name: charge.applies_scope === 'origin' ? charge.origin_port_name : charge.destination_port_name,
          container_type: charge.surcharge_container_type || charge.container_type
        })) || [];
      };

      const processedOriginCharges = processCharges(originCharges);
      const processedDestCharges = processCharges(destCharges);

      return {
        success: true,
        data: {
          origin_charges: processedOriginCharges,
          destination_charges: processedDestCharges,
          origin_total_usd: Math.round(processedOriginCharges.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) * 100) / 100,
          destination_total_usd: Math.round(processedDestCharges.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) * 100) / 100,
          origin_total_local: originCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0,
          destination_total_local: destCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0,
          fx_rates: fxRates,
          summary: {
            pol_code,
            pod_code,
            container_type,
            vendor_filter: vendor_name,
            origin_charges_count: originCharges?.length || 0,
            destination_charges_count: destCharges?.length || 0,
            currencies_found: [...new Set([
              ...(originCharges?.map((c: any) => c.charge_currency) || []),
              ...(destCharges?.map((c: any) => c.charge_currency) || [])
            ])],
            fx_date: new Date().toISOString().split('T')[0],
          }
        }
      };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error instanceof Error ? error.message : JSON.stringify(error) };
    }
  });

  // 3. Prepare Quote endpoint
  fastify.post('/api/prepare-quote', async (request, reply) => {
    try {
      const { salesforce_org_id, pol_code, pod_code, container_type, container_count = 1 } = request.body as any;

      // 1. Get Ocean Freight (All-in Sell) from mv_freight_sell_prices
      const { data: freightData, error: freightError } = await supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('pol_code', pol_code)
        .eq('pod_code', pod_code)
        .eq('container_type', container_type)
        .eq('is_preferred', true)
        .single();

      if (freightError && freightError.code !== 'PGRST116') throw freightError;

      // Get the contract_id and pol/pod IDs from the preferred freight rate
      const contractId = freightData?.contract_id;
      const polId = freightData?.pol_id;
      const podId = freightData?.pod_id;

      // 2. Get Origin Charges from v_local_charges_details (filtered by contract, port, and container type)
      const { data: originChargesRaw, error: originError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .eq('pol_id', polId)
        .eq('charge_location_type', 'Origin Charges')
        .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

      if (originError) throw originError;

      // 3. Get Destination Charges from v_local_charges_details (filtered by contract, port, and container type)
      const { data: destChargesRaw, error: destError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .eq('pod_id', podId)
        .eq('charge_location_type', 'Destination Charges')
        .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

      if (destError) throw destError;

      // 4. Get Other Charges (if they exist)
      const { data: otherChargesRaw, error: otherError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .not('charge_location_type', 'in', '(Origin Charges,Destination Charges)')
        .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

      if (otherError) throw otherError;

      // Deduplicate charges by charge_code (take first occurrence only)
      const deduplicateCharges = (charges: any[]) => {
        const seen = new Set();
        return charges?.filter((charge: any) => {
          if (seen.has(charge.charge_code)) {
            return false;
          }
          seen.add(charge.charge_code);
          return true;
        }) || [];
      };

      const originCharges = deduplicateCharges(originChargesRaw);
      const destCharges = deduplicateCharges(destChargesRaw);
      const otherCharges = deduplicateCharges(otherChargesRaw);

      // Get FX rates for currency conversion
      const currencies = [...new Set([
        ...(originCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
        ...(destCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
        ...(otherCharges?.map((c: any) => c.charge_currency).filter(Boolean) || [])
      ])].filter(c => c !== 'USD');

      let fxRates: { [key: string]: number } = {};
      if (currencies.length > 0) {
        const { data: fxData, error: fxError } = await supabase
          .from('fx_rate')
          .select('rate_date, base_ccy, quote_ccy, rate')
          .eq('quote_ccy', 'USD')
          .in('base_ccy', currencies)
          .lte('rate_date', new Date().toISOString().split('T')[0])
          .order('rate_date', { ascending: false });

        if (fxError) throw fxError;

        fxRates = fxData?.reduce((acc: { [key: string]: number }, fx: any) => {
          acc[fx.base_ccy] = fx.rate;
          return acc;
        }, {}) || {};
      }

      // Helper function to convert currency to USD with fallback rates
      const convertToUSD = (amount: number, currency: string) => {
        if (!amount || currency === 'USD') return amount;
        
        // Try to use database FX rate first
        if (fxRates[currency]) {
          return Math.round(amount * fxRates[currency] * 100) / 100;
        }
        
        // Fallback rates (how many USD per 1 unit of foreign currency)
        const fallbackRates: { [key: string]: number } = {
          'INR': 1/83.0,   // 1 INR = ~0.012 USD
          'EUR': 1/0.85,   // 1 EUR = ~1.176 USD
          'AED': 1/3.67,   // 1 AED = ~0.272 USD
          'GBP': 1/0.73,   // 1 GBP = ~1.370 USD
          'JPY': 1/110.0,  // 1 JPY = ~0.009 USD
          'CNY': 1/7.2,    // 1 CNY = ~0.139 USD
        };
        
        const rate = fallbackRates[currency] || 1;
        return Math.round(amount * rate * 100) / 100;
      };

      // Process charges with USD conversion
      const processCharges = (charges: any[]) => {
        return charges?.map((charge: any) => ({
          ...charge,
          amount_usd: convertToUSD(charge.charge_amount, charge.charge_currency),
          fx_rate: fxRates[charge.charge_currency] || 1,
          currency_converted: charge.charge_currency !== 'USD'
        })) || [];
      };

      const processedOriginCharges = processCharges(originCharges);
      const processedDestCharges = processCharges(destCharges);
      const processedOtherCharges = processCharges(otherCharges);

      // Calculate totals (both local and USD) - rounded to 2 decimal places
      const oceanFreightSell = freightData?.all_in_freight_sell || 0;
      const originTotalUSD = Math.round(processedOriginCharges.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) * 100) / 100;
      const destTotalUSD = Math.round(processedDestCharges.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) * 100) / 100;
      const otherTotalUSD = Math.round(processedOtherCharges.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) * 100) / 100;
      
      const originTotalLocal = originCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0;
      const destTotalLocal = destCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0;
      const otherTotalLocal = otherCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0;

      const grandTotal = Math.round((oceanFreightSell + originTotalUSD + destTotalUSD + otherTotalUSD) * container_count * 100) / 100;

      return {
        success: true,
        data: {
          salesforce_org_id,
          route: {
            pol: pol_code,
            pod: pod_code,
            container_type,
            container_count,
          },
          quote_parts: {
            ocean_freight: {
              carrier: freightData?.carrier || 'N/A',
              all_in_freight_sell: oceanFreightSell,
              ocean_freight_buy: freightData?.ocean_freight_buy || 0,
              freight_surcharges: freightData?.freight_surcharges || 0,
              margin: {
                type: freightData?.margin_type || 'N/A',
                percentage: freightData?.margin_percentage || 0,
                amount: freightData?.margin_amount || 0,
              },
              currency: freightData?.currency || 'USD',
              transit_days: freightData?.transit_days || 0,
              validity: {
                from: freightData?.valid_from,
                to: freightData?.valid_to,
              },
              is_preferred: freightData?.is_preferred || false,
              rate_id: freightData?.rate_id,
            },
            origin_charges: {
              charges: processedOriginCharges,
              total_local: originTotalLocal,
              total_usd: originTotalUSD,
              count: processedOriginCharges.length,
            },
            destination_charges: {
              charges: processedDestCharges,
              total_local: destTotalLocal,
              total_usd: destTotalUSD,
              count: processedDestCharges.length,
            },
            other_charges: {
              charges: processedOtherCharges,
              total_local: otherTotalLocal,
              total_usd: otherTotalUSD,
              count: processedOtherCharges.length,
            },
          },
          totals: {
            ocean_freight_total: oceanFreightSell * container_count,
            origin_total_local: originTotalLocal * container_count,
            origin_total_usd: originTotalUSD * container_count,
            destination_total_local: destTotalLocal * container_count,
            destination_total_usd: destTotalUSD * container_count,
            other_total_local: otherTotalLocal * container_count,
            other_total_usd: otherTotalUSD * container_count,
            grand_total_usd: grandTotal,
            currency: 'USD',
            fx_rates: fxRates,
            currencies_used: [...new Set([
              ...(originCharges?.map((c: any) => c.charge_currency) || []),
              ...(destCharges?.map((c: any) => c.charge_currency) || []),
              ...(otherCharges?.map((c: any) => c.charge_currency) || [])
            ])].filter(Boolean),
          },
          quote_summary: {
            route_display: freightData ? `${freightData.pol_name} (${pol_code}) → ${freightData.pod_name} (${pod_code})` : `${pol_code} → ${pod_code}`,
            container_info: `${container_count}x ${container_type}`,
            total_charges_breakdown: {
              ocean_freight_usd: oceanFreightSell * container_count,
              local_charges_usd: (originTotalUSD + destTotalUSD + otherTotalUSD) * container_count,
            },
            vendor_info: {
              carrier: freightData?.carrier || 'N/A',
              transit_days: freightData?.transit_days || 0,
            },
            currency_conversion: {
              fx_rates_applied: fxRates,
              fx_date: new Date().toISOString().split('T')[0],
              currencies_converted: currencies,
            },
          },
          metadata: {
            generated_at: new Date().toISOString(),
            pol_code,
            pod_code,
            container_type,
            container_count,
          }
        }
      };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error instanceof Error ? error.message : JSON.stringify(error) };
    }
  });

  // ===== V2 API ENDPOINTS FOR SIMPLIFIED SINGLE-RATE QUOTE FLOW =====

  // V2: Search Rates (same as V1 but with V2 endpoint)
  fastify.post('/api/v2/search-rates', async (request, reply) => {
    try {
      const { pol_code, pod_code, container_type, vendor_name, salesforce_org_id } = request.body as any;

      // Validate required parameters
      if (!pol_code || !pod_code) {
        return reply.code(400).send({
          success: false,
          error: 'pol_code and pod_code are required'
        });
      }

      let query = supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('pol_code', pol_code)
        .eq('pod_code', pod_code);

      if (container_type) {
        query = query.eq('container_type', container_type);
      }

      if (vendor_name) {
        query = query.ilike('carrier', `%${vendor_name}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Format the response nicely
      const formattedData = data?.map(rate => ({
        vendor: rate.carrier,
        route: `${rate.pol_name} → ${rate.pod_name}`,
        container_type: rate.container_type,
        transit_days: rate.transit_days,
        pricing: {
          ocean_freight_buy: rate.ocean_freight_buy,
          freight_surcharges: rate.freight_surcharges,
          all_in_freight_buy: rate.all_in_freight_buy,
          margin: {
            type: rate.margin_type,
            percentage: rate.margin_percentage,
            amount: rate.margin_amount,
          },
          all_in_freight_sell: rate.all_in_freight_sell,
          currency: rate.currency,
        },
        validity: {
          from: rate.valid_from,
          to: rate.valid_to,
        },
        is_preferred: rate.is_preferred,
        rate_id: rate.rate_id,
      }));

      return { success: true, data: formattedData };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error instanceof Error ? error.message : JSON.stringify(error) };
    }
  });

  // V2: Create Single-Rate Quote (Simplified)
  fastify.post('/api/v2/prepare-quote', async (request, reply) => {
    try {
      const { salesforce_org_id, rate_id, container_count = 1 } = request.body as any;

      if (!salesforce_org_id || !rate_id) {
        return reply.code(400).send({
          success: false,
          error: 'salesforce_org_id and rate_id are required'
        });
      }

      // Validate container_count if provided
      if (container_count && (container_count < 1 || container_count > 10)) {
        return reply.code(400).send({
          success: false,
          error: 'container_count must be between 1 and 10'
        });
      }

      // Get rate details from database
      const { data: rateData, error: rateError } = await supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('rate_id', rate_id)
        .single();

      if (rateError || !rateData) {
        return reply.code(404).send({
          success: false,
          error: 'Rate not found'
        });
      }

      // Get contract_id and pol/pod IDs from the rate
      const contractId = rateData.contract_id;
      const polId = rateData.pol_id;
      const podId = rateData.pod_id;
      const containerType = rateData.container_type;

      // Get Origin Charges (same logic as V1)
      const { data: originChargesRaw, error: originError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .eq('pol_id', polId)
        .eq('charge_location_type', 'Origin Charges')
        .eq('applies_scope', 'origin')
        .or(`surcharge_container_type.eq.${containerType},surcharge_container_type.is.null`);

      // Get Destination Charges (same logic as V1)
      const { data: destChargesRaw, error: destError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .eq('pod_id', podId)
        .eq('charge_location_type', 'Destination Charges')
        .eq('applies_scope', 'dest')
        .or(`surcharge_container_type.eq.${containerType},surcharge_container_type.is.null`);

      // Get Other Charges (same logic as V1)
      const { data: otherChargesRaw, error: otherError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .not('charge_location_type', 'in', '(Origin Charges,Destination Charges)')
        .or(`surcharge_container_type.eq.${containerType},surcharge_container_type.is.null`);

      // Deduplicate charges by charge_code (same logic as V1)
      const deduplicateCharges = (charges: any[]) => {
        const seen = new Set();
        return charges?.filter((charge: any) => {
          if (seen.has(charge.charge_code)) {
            return false;
          }
          seen.add(charge.charge_code);
          return true;
        }) || [];
      };

      const originCharges = deduplicateCharges(originChargesRaw || []);
      const destCharges = deduplicateCharges(destChargesRaw || []);
      const otherCharges = deduplicateCharges(otherChargesRaw || []);

      // Get FX rates for currency conversion (same logic as V1)
      const currencies = [...new Set([
        ...(originCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
        ...(destCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
        ...(otherCharges?.map((c: any) => c.charge_currency).filter(Boolean) || [])
      ])].filter(c => c !== 'USD');

      let fxRates: { [key: string]: number } = {};
      if (currencies.length > 0) {
        // Try to get FX rates for today first, then fall back to latest available
        const { data: fxData, error: fxError } = await supabase
          .from('fx_rate')
          .select('rate_date, base_ccy, quote_ccy, rate')
          .eq('quote_ccy', 'USD')
          .in('base_ccy', currencies)
          .lte('rate_date', new Date().toISOString().split('T')[0])
          .order('rate_date', { ascending: false });

        if (fxData && fxData.length > 0) {
          // Group by currency and take the latest rate for each
          const latestRates: { [key: string]: any } = {};
          fxData.forEach((fx: any) => {
            if (!latestRates[fx.base_ccy]) {
              latestRates[fx.base_ccy] = fx;
            }
          });
          
          Object.values(latestRates).forEach((fx: any) => {
            fxRates[fx.base_ccy] = fx.rate;
          });
        }
      }

           // Process charges with currency conversion (same logic as V1)
           const processCharges = (charges: any[]) => {
             return charges?.map((charge: any) => {
               const fxRate = fxRates[charge.charge_currency] || 1;
               const amountUSD = charge.charge_currency === 'USD' ? charge.charge_amount : charge.charge_amount * fxRate;
               return {
                 ...charge,
                 amount_usd: Math.round(amountUSD * 100) / 100
               };
             }) || [];
           };

      const processedOriginCharges = processCharges(originCharges);
      const processedDestCharges = processCharges(destCharges);
      const processedOtherCharges = processCharges(otherCharges);

      // Calculate totals (same logic as V1)
      const oceanFreightSell = rateData.all_in_freight_sell || 0;
      const originTotalUSD = processedOriginCharges?.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) || 0;
      const destTotalUSD = processedDestCharges?.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) || 0;
      const otherTotalUSD = processedOtherCharges?.reduce((sum: number, charge: any) => sum + (charge.amount_usd || 0), 0) || 0;

      const originTotalLocal = originCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0;
      const destTotalLocal = destCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0;
      const otherTotalLocal = otherCharges?.reduce((sum: number, charge: any) => sum + (charge.charge_amount || 0), 0) || 0;

      const grandTotal = Math.round((oceanFreightSell + originTotalUSD + destTotalUSD + otherTotalUSD) * container_count * 100) / 100;

      return {
        success: true,
        data: {
          salesforce_org_id,
          rate_id,
          route: {
            pol: rateData.pol_code,
            pod: rateData.pod_code,
            container_type: rateData.container_type,
            container_count: container_count,
          },
          quote_parts: {
            ocean_freight: {
              carrier: rateData.carrier || 'N/A',
              all_in_freight_sell: oceanFreightSell,
              ocean_freight_buy: rateData.ocean_freight_buy || 0,
              freight_surcharges: rateData.freight_surcharges || 0,
              margin: {
                type: rateData.margin_type || 'N/A',
                percentage: rateData.margin_percentage || 0,
                amount: rateData.margin_amount || 0,
              },
              currency: rateData.currency || 'USD',
              transit_days: rateData.transit_days || 0,
              validity: {
                from: rateData.valid_from,
                to: rateData.valid_to,
              },
              is_preferred: rateData.is_preferred || false,
              rate_id: rateData.rate_id,
            },
            origin_charges: {
              charges: processedOriginCharges,
              total_local: originTotalLocal,
              total_usd: originTotalUSD,
              count: processedOriginCharges.length,
            },
            destination_charges: {
              charges: processedDestCharges,
              total_local: destTotalLocal,
              total_usd: destTotalUSD,
              count: processedDestCharges.length,
            },
            other_charges: {
              charges: processedOtherCharges,
              total_local: otherTotalLocal,
              total_usd: otherTotalUSD,
              count: processedOtherCharges.length,
            },
          },
          totals: {
            ocean_freight_total: oceanFreightSell * container_count,
            origin_total_local: originTotalLocal * container_count,
            origin_total_usd: originTotalUSD * container_count,
            destination_total_local: destTotalLocal * container_count,
            destination_total_usd: destTotalUSD * container_count,
            other_total_local: otherTotalLocal * container_count,
            other_total_usd: otherTotalUSD * container_count,
            grand_total_usd: grandTotal,
            currency: 'USD',
            fx_rates: fxRates,
            currencies_used: [...new Set([
              ...(originCharges?.map((c: any) => c.charge_currency) || []),
              ...(destCharges?.map((c: any) => c.charge_currency) || []),
              ...(otherCharges?.map((c: any) => c.charge_currency) || [])
            ])].filter(Boolean),
          },
          quote_summary: {
            route_display: rateData ? `${rateData.pol_name} (${rateData.pol_code}) → ${rateData.pod_name} (${rateData.pod_code})` : `${rateData.pol_code} → ${rateData.pod_code}`,
            container_info: `${container_count}x ${rateData.container_type}`,
            total_charges_breakdown: {
              ocean_freight_usd: oceanFreightSell * container_count,
              local_charges_usd: (originTotalUSD + destTotalUSD + otherTotalUSD) * container_count,
            },
            vendor_info: {
              carrier: rateData.carrier || 'N/A',
              transit_days: rateData.transit_days || 0,
            },
            currency_conversion: {
              fx_rates_applied: fxRates,
              fx_date: new Date().toISOString().split('T')[0],
              currencies_converted: currencies,
            },
          },
          metadata: {
            generated_at: new Date().toISOString(),
            pol_code: rateData.pol_code,
            pod_code: rateData.pod_code,
            container_type: rateData.container_type,
            container_count: container_count,
          }
        }
      };

    } catch (error) {
      reply.code(500);
      return { success: false, error: error instanceof Error ? error.message : JSON.stringify(error) };
    }
  });

  // 4. Prepare Quote V3 endpoint (IHE/IHI Haulage Only)
  fastify.post('/api/v3/prepare-quote', async (request, reply) => {
    try {
      const { 
        pol_code, 
        pod_code, 
        container_type, 
        container_count = 1,
        cargo_weight_mt,
        haulage_type
      } = request.body as any;

      // Call the simplified inland function for IHE/IHI only
      const { data: result, error } = await supabase.rpc('simplified_inland_function', {
        p_pol_code: pol_code,
        p_pod_code: pod_code,
        p_container_type: container_type,
        p_container_count: container_count,
        p_cargo_weight_mt: cargo_weight_mt,
        p_haulage_type: haulage_type
      });

      if (error) {
        throw new Error(`V3 function error: ${error.message}`);
      }

      if (!result || !result.success) {
        throw new Error(result?.error_message || 'V3 function failed');
      }

      // Return only haulage charges (IHE/IHI)
      return {
        success: true,
        data: {
          ...result,
          metadata: {
            generated_at: new Date().toISOString(),
            pol_code,
            pod_code,
            container_type,
            container_count,
            api_version: 'v3',
            haulage_only: true
          }
        }
      };
    } catch (error) {
      console.error('V3 Haulage Error:', error);
      reply.code(500);
      return { success: false, error: error instanceof Error ? error.message : JSON.stringify(error) };
    }
  });

  // 5. Get Inland Haulage endpoint (Simplified for n8n orchestration)
  fastify.post('/api/v3/get-inland-haulage', async (request, reply) => {
    try {
      const { 
        pol_code, 
        pod_code, 
        container_type, 
        container_count = 1,
        cargo_weight_mt,
        haulage_type
      } = request.body as any;

      // Call the simplified inland function for IHE/IHI only
      const { data: result, error } = await supabase.rpc('simplified_inland_function', {
        p_pol_code: pol_code,
        p_pod_code: pod_code,
        p_container_type: container_type,
        p_container_count: container_count,
        p_cargo_weight_mt: cargo_weight_mt,
        p_haulage_type: haulage_type
      });

      if (error) {
        throw new Error(`Inland haulage error: ${error.message}`);
      }

      if (!result || !result.success) {
        throw new Error(result?.error_message || 'Inland haulage function failed');
      }

      // Return simplified haulage charges for n8n orchestration
      return {
        success: true,
        data: {
          pol_code,
          pod_code,
          pol_is_inland: result.pol_is_inland,
          pod_is_inland: result.pod_is_inland,
          container_type,
          container_count,
          haulage_type,
          ihe_charges: result.ihe_charges,
          ihi_charges: result.ihi_charges,
          total_haulage_usd: (result.ihe_charges?.total_amount_usd || 0) + (result.ihi_charges?.total_amount_usd || 0),
          exchange_rate: result.exchange_rate,
          metadata: {
            generated_at: new Date().toISOString(),
            api_version: 'v3',
            endpoint: 'get-inland-haulage'
          }
        }
      };
    } catch (error) {
      console.error('Get Inland Haulage Error:', error);
      reply.code(500);
      return { success: false, error: error instanceof Error ? error.message : JSON.stringify(error) };
    }
  });

  // ==========================================
  // OCEAN FREIGHT RATE CRUD APIs
  // ==========================================

  // Create Ocean Freight Rate
  fastify.post('/api/ocean-freight-rates', async (request, reply) => {
    try {
      const { 
        pol_code, 
        pod_code, 
        container_type, 
        buy_amount, 
        currency,
        tt_days, 
        is_preferred, 
        valid_from, 
        valid_to,
        contract_id,
        via_port_code
      } = request.body as any;

      // Validate required fields
      if (!pol_code || !pod_code || !container_type || !buy_amount || !currency || !contract_id) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: pol_code, pod_code, container_type, buy_amount, currency, contract_id'
        });
      }

      // Get location IDs using unlocode (like MCP tool)
      const { data: polData, error: polError } = await supabase
        .from('locations')
        .select('id')
        .eq('unlocode', pol_code)
        .eq('is_active', true)
        .single();

      if (polError || !polData) {
        return reply.status(404).send({
          success: false,
          error: `POL location not found: ${pol_code}`
        });
      }

      const { data: podData, error: podError } = await supabase
        .from('locations')
        .select('id')
        .eq('unlocode', pod_code)
        .eq('is_active', true)
        .single();

      if (podError || !podData) {
        return reply.status(404).send({
          success: false,
          error: `POD location not found: ${pod_code}`
        });
      }

      // Get via port ID if provided
      let viaPortId = null;
      if (via_port_code) {
        const { data: viaPortData, error: viaPortError } = await supabase
          .from('locations')
          .select('id')
          .eq('unlocode', via_port_code)
          .eq('is_active', true)
          .single();

        if (viaPortError || !viaPortData) {
          return reply.status(404).send({
            success: false,
            error: `Via port location not found: ${via_port_code}`
          });
        }
        viaPortId = viaPortData.id;
      }

      // Create the ocean freight rate with correct schema fields
      const { data, error } = await supabase
        .from('ocean_freight_rate')
        .insert({
          pol_id: polData.id,
          pod_id: podData.id,
          contract_id: contract_id,
          container_type,
          buy_amount,
          currency,
          tt_days: tt_days || null,
          via_port_id: viaPortId,
          is_preferred: is_preferred || false,
          valid_from: valid_from || new Date().toISOString().split('T')[0],
          valid_to: valid_to || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tenant_id: (request as any).tenant_id
        })
        .select(`
          id,
          contract_id,
          pol_id,
          pod_id,
          container_type,
          buy_amount,
          currency,
          tt_days,
          via_port_id,
          is_preferred,
          valid_from,
          valid_to,
          tenant_id
        `)
        .single();

      if (error) throw error;

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update Ocean Freight Rate
  fastify.put('/api/ocean-freight-rates/:rateId', async (request, reply) => {
    try {
      const { rateId } = request.params as any;
      const { 
        buy_amount, 
        currency,
        tt_days, 
        is_preferred, 
        valid_from, 
        valid_to 
      } = request.body as any;

      const updates: any = {};

      if (buy_amount !== undefined) updates.buy_amount = buy_amount;
      if (currency !== undefined) updates.currency = currency;
      if (tt_days !== undefined) updates.tt_days = tt_days;
      if (is_preferred !== undefined) updates.is_preferred = is_preferred;
      if (valid_from !== undefined) updates.valid_from = valid_from;
      if (valid_to !== undefined) updates.valid_to = valid_to;

      const { data, error } = await supabase
        .from('ocean_freight_rate')
        .update(updates)
        .eq('id', rateId)
        .eq('tenant_id', (request as any).tenant_id)
        .select(`
          id,
          contract_id,
          pol_id,
          pod_id,
          container_type,
          buy_amount,
          currency,
          tt_days,
          via_port_id,
          is_preferred,
          valid_from,
          valid_to,
          tenant_id
        `)
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: `Ocean freight rate not found: ${rateId}`
        });
      }

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete Ocean Freight Rate
  fastify.delete('/api/ocean-freight-rates/:rateId', async (request, reply) => {
    try {
      const { rateId } = request.params as any;

      // Soft delete by setting is_active to false
      const { data, error } = await supabase
        .from('ocean_freight_rate')
        .update({
          is_active: false,
          updated_by: 'api_user',
          updated_at: new Date().toISOString()
        })
        .eq('id', rateId)
        .select('id, is_active')
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: `Ocean freight rate not found: ${rateId}`
        });
      }

      return reply.send({
        success: true,
        message: `Ocean freight rate ${rateId} deleted successfully`
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get Ocean Freight Rate by ID
  fastify.get('/api/ocean-freight-rates/:rateId', async (request, reply) => {
    try {
      const { rateId } = request.params as any;

      // Use the same materialized view that the working APIs use
      const { data, error } = await supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('rate_id', rateId)
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: `Ocean freight rate not found: ${rateId}`
        });
      }

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List Ocean Freight Rates
  fastify.get('/api/ocean-freight-rates', async (request, reply) => {
    try {
      const { 
        pol_code, 
        pod_code, 
        origin,
        destination,
        origin_trade_zone,
        destination_trade_zone,
        vendor_name, 
        container_type, 
        is_preferred, 
        is_active = 'true',
        page = '1',
        limit = '50'
      } = request.query as any;

      let query = supabase
        .from('mv_freight_sell_prices')
        .select('*');

      // Apply filters using materialized view fields
      if (container_type) {
        query = query.eq('container_type', container_type);
      }

      if (is_preferred !== undefined) {
        query = query.eq('is_preferred', is_preferred === 'true');
      }

      // Prefer origin/destination (v4 API fields), fallback to pol_code/pod_code
      // Note: Materialized view has origin_code/destination_code, not origin/destination
      if (origin) {
        query = query.eq('origin_code', origin);
      } else if (pol_code) {
        query = query.eq('pol_code', pol_code);
      }

      if (destination) {
        query = query.eq('destination_code', destination);
      } else if (pod_code) {
        query = query.eq('pod_code', pod_code);
      }

      // Trade zone filters - query locations table to get matching UN/LOCODEs
      if (origin_trade_zone) {
        try {
          // Get all UN/LOCODEs that match the origin trade zone
          const { data: originLocations, error: originLocError } = await supabase
            .from('locations')
            .select('unlocode')
            .ilike('trade_zone', `%${origin_trade_zone}%`);
          
          if (originLocError) {
            console.error('Error querying origin trade zone:', originLocError);
            throw new Error(`Error querying origin trade zone: ${originLocError.message}`);
          }
          
          if (originLocations && originLocations.length > 0) {
            const originUnlocodes = originLocations.map(loc => loc.unlocode).filter(Boolean);
            // Filter by origin_code (v4) or pol_code (legacy) matching the trade zone
            if (originUnlocodes.length > 0) {
              // Filter by origin_code (v4) or pol_code (legacy) matching the trade zone
              // Use PostgREST OR syntax: column1.in.(val1,val2),column2.in.(val1,val2)
              // Note: Supabase .in() expects an array, but .or() uses PostgREST string syntax
              const unlocodeList = originUnlocodes.join(',');
              query = query.or(`origin_code.in.(${unlocodeList}),pol_code.in.(${unlocodeList})`);
            } else {
              // If no matching locations, return empty result
              return reply.send({
                success: true,
                data: [],
                pagination: { page: 1, limit: 50, count: 0 }
              });
            }
          } else {
            // If no matching locations, return empty result
            return reply.send({
              success: true,
              data: [],
              pagination: { page: 1, limit: 50, count: 0 }
            });
          }
        } catch (error) {
          console.error('Error in origin trade zone filter:', error);
          // If trade zone filtering fails, continue without it (fallback)
          // This prevents the entire query from failing
        }
      }

      if (destination_trade_zone) {
        try {
          // Get all UN/LOCODEs that match the destination trade zone
          const { data: destLocations, error: destLocError } = await supabase
            .from('locations')
            .select('unlocode')
            .ilike('trade_zone', `%${destination_trade_zone}%`);
          
          if (destLocError) {
            console.error('Error querying destination trade zone:', destLocError);
            throw new Error(`Error querying destination trade zone: ${destLocError.message}`);
          }
          
          if (destLocations && destLocations.length > 0) {
            const destUnlocodes = destLocations.map(loc => loc.unlocode).filter(Boolean);
            // Filter by destination_code (v4) or pod_code (legacy) matching the trade zone
            if (destUnlocodes.length > 0) {
              // Filter by destination_code (v4) or pod_code (legacy) matching the trade zone
              // Use PostgREST OR syntax: column1.in.(val1,val2),column2.in.(val1,val2)
              // Note: Supabase .in() expects an array, but .or() uses PostgREST string syntax
              const unlocodeList = destUnlocodes.join(',');
              query = query.or(`destination_code.in.(${unlocodeList}),pod_code.in.(${unlocodeList})`);
            } else {
              // If no matching locations, return empty result
              return reply.send({
                success: true,
                data: [],
                pagination: { page: 1, limit: 50, count: 0 }
              });
            }
          } else {
            // If no matching locations, return empty result
            return reply.send({
              success: true,
              data: [],
              pagination: { page: 1, limit: 50, count: 0 }
            });
          }
        } catch (error) {
          console.error('Error in destination trade zone filter:', error);
          // If trade zone filtering fails, continue without it (fallback)
          // This prevents the entire query from failing
        }
      }

      if (vendor_name) {
        query = query.eq('carrier', vendor_name);
      }

      // Order by rate_id
      query = query.order('rate_id', { ascending: false });

      // Apply pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query = query.range(offset, offset + limitNum - 1);

      const { data, error } = await query;

      if (error) throw error;

      return reply.send({
        success: true,
        data: data || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          count: data?.length || 0
        }
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==========================================
  // SURCHARGE CRUD APIs (using surcharge table directly)
  // ==========================================

  // Create Surcharge
  fastify.post('/api/surcharges', async (request, reply) => {
    try {
      console.log('🔍 [SURCHARGE CREATE] Starting surcharge creation request');
      console.log('🔍 [SURCHARGE CREATE] Tenant ID:', (request as any).tenant_id);
      console.log('🔍 [SURCHARGE CREATE] Request body:', request.body);
      
      const { 
        vendor_id,
        contract_id,
        charge_code,
        amount,
        currency,
        uom,
        pol_code,
        pod_code,
        container_type,
        applies_scope,
        valid_from,
        valid_to
      } = request.body as any;

      // Validate required fields
      console.log('🔍 [SURCHARGE CREATE] Validating required fields...');
      if (!vendor_id || !charge_code || !amount || !valid_from || !valid_to || !applies_scope) {
        console.log('❌ [SURCHARGE CREATE] Missing required fields:', { vendor_id, charge_code, amount, valid_from, valid_to, applies_scope });
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: vendor_id, charge_code, amount, valid_from, valid_to, applies_scope'
        });
      }

      // Validate applies_scope
      console.log('🔍 [SURCHARGE CREATE] Validating applies_scope:', applies_scope);
      if (!['origin', 'port', 'freight', 'dest', 'door', 'other'].includes(applies_scope)) {
        console.log('❌ [SURCHARGE CREATE] Invalid applies_scope:', applies_scope);
        return reply.status(400).send({
          success: false,
          error: 'applies_scope must be one of: "origin", "port", "freight", "dest", "door", "other"'
        });
      }

      // Validate uom
      const finalUom = uom || 'per_cntr';
      console.log('🔍 [SURCHARGE CREATE] Validating uom:', finalUom);
      if (!['per_cntr', 'per_bl', 'per_shipment', 'per_kg', 'per_cbm'].includes(finalUom)) {
        console.log('❌ [SURCHARGE CREATE] Invalid uom:', finalUom);
        return reply.status(400).send({
          success: false,
          error: 'uom must be one of: "per_cntr", "per_bl", "per_shipment", "per_kg", "per_cbm"'
        });
      }

      // Validate calc_method
      const calcMethod = 'flat'; // Default to flat for now
      console.log('🔍 [SURCHARGE CREATE] Using calc_method:', calcMethod);
      if (!['flat', 'percentage', 'tier'].includes(calcMethod)) {
        console.log('❌ [SURCHARGE CREATE] Invalid calc_method:', calcMethod);
        return reply.status(400).send({
          success: false,
          error: 'calc_method must be one of: "flat", "percentage", "tier"'
        });
      }

      console.log('🔍 [SURCHARGE CREATE] Creating insert data...');
      const insertData: any = {
        vendor_id,
        contract_id: contract_id || 1, // Required field - use default if not provided
        charge_code,
        amount,
        currency: currency || 'USD',
        uom: finalUom,
        calc_method: calcMethod, // Required field - validated above
        container_type: container_type || null,
        applies_scope,
        valid_from,
        valid_to,
        tenant_id: (request as any).tenant_id
      };
      console.log('🔍 [SURCHARGE CREATE] Insert data created:', insertData);

      // Get location IDs based on applies_scope
      if ((applies_scope === 'origin' || applies_scope === 'port') && pol_code) {
        console.log('🔍 [SURCHARGE CREATE] Looking up origin/port location:', pol_code);
        const { data: polData, error: polError } = await supabase
          .from('locations')
          .select('id')
          .eq('unlocode', pol_code)
          .eq('is_active', true)
          .single();

        if (polError || !polData) {
          console.log('❌ [SURCHARGE CREATE] Origin/port location not found:', pol_code, polError);
          return reply.status(404).send({
            success: false,
            error: `Origin/port location not found: ${pol_code}`
          });
        }
        insertData.pol_id = polData.id;
        console.log('✅ [SURCHARGE CREATE] Origin/port location found:', polData.id);
      }

      if ((applies_scope === 'dest' || applies_scope === 'door') && pod_code) {
        console.log('🔍 [SURCHARGE CREATE] Looking up destination/door location:', pod_code);
        const { data: podData, error: podError } = await supabase
          .from('locations')
          .select('id')
          .eq('unlocode', pod_code)
          .eq('is_active', true)
          .single();

        if (podError || !podData) {
          console.log('❌ [SURCHARGE CREATE] Destination/door location not found:', pod_code, podError);
          return reply.status(404).send({
            success: false,
            error: `Destination/door location not found: ${pod_code}`
          });
        }
        insertData.pod_id = podData.id;
        console.log('✅ [SURCHARGE CREATE] Destination/door location found:', podData.id);
      }

      // Create the surcharge
      console.log('🔍 [SURCHARGE CREATE] Inserting surcharge into database...');
      console.log('🔍 [SURCHARGE CREATE] Final insert data:', insertData);
      
      const { data, error } = await supabase
        .from('surcharge')
        .insert(insertData)
        .select('*')
        .single();

      if (error) {
        console.error('❌ [SURCHARGE CREATE] Database insert error:', error);
        throw error;
      }

      console.log('✅ [SURCHARGE CREATE] Surcharge created successfully:', data);
      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      console.error('❌ [SURCHARGE CREATE] Unexpected error:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update Surcharge
  fastify.put('/api/surcharges/:surchargeId', async (request, reply) => {
    try {
      const { surchargeId } = request.params as any;
      const { 
        amount,
        currency,
        uom,
        valid_from,
        valid_to
      } = request.body as any;

      const updates: any = {};

      if (amount !== undefined) updates.amount = amount;
      if (currency !== undefined) updates.currency = currency;
      if (uom !== undefined) updates.uom = uom;
      if (valid_from !== undefined) updates.valid_from = valid_from;
      if (valid_to !== undefined) updates.valid_to = valid_to;

      const { data, error } = await supabase
        .from('surcharge')
        .update(updates)
        .eq('id', surchargeId)
        .eq('tenant_id', request.headers['x-tenant-id'] || 'default_tenant')
        .select('*')
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: `Surcharge not found: ${surchargeId}`
        });
      }

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete Surcharge
  fastify.delete('/api/surcharges/:surchargeId', async (request, reply) => {
    try {
      const { surchargeId } = request.params as any;

      // Soft delete by setting is_active to false
      const { data, error } = await supabase
        .from('surcharge')
        .update({
          is_active: false
        })
        .eq('id', surchargeId)
        .eq('tenant_id', (request as any).tenant_id)
        .select('id, is_active')
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: `Surcharge not found: ${surchargeId}`
        });
      }

      return reply.send({
        success: true,
        message: `Surcharge ${surchargeId} deleted successfully`
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get Surcharge by ID
  fastify.get('/api/surcharges/:surchargeId', async (request, reply) => {
    try {
      const { surchargeId } = request.params as any;

      const { data, error } = await supabase
        .from('surcharge')
        .select('*')
        .eq('id', surchargeId)
        .eq('tenant_id', request.headers['x-tenant-id'] || 'default_tenant')
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: `Surcharge not found: ${surchargeId}`
        });
      }

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List Surcharges
  fastify.get('/api/surcharges', async (request, reply) => {
    try {
      console.log('🔍 [SURCHARGE LIST] Starting surcharge list request');
      console.log('🔍 [SURCHARGE LIST] Tenant ID:', (request as any).tenant_id);
      
      const { 
        vendor_id,
        contract_id,
        charge_code,
        container_type,
        applies_scope,
        is_active = 'true',
        page = '1',
        limit = '50'
      } = request.query as any;

      console.log('🔍 [SURCHARGE LIST] Query params:', { vendor_id, contract_id, charge_code, container_type, applies_scope, is_active, page, limit });

      let query = supabase
        .from('surcharge')
        .select('*')
        .eq('tenant_id', (request as any).tenant_id);

      console.log('🔍 [SURCHARGE LIST] Base query created');

      // Apply filters
      if (is_active !== undefined) {
        query = query.eq('is_active', is_active === 'true');
        console.log('🔍 [SURCHARGE LIST] Applied is_active filter:', is_active === 'true');
      }

      if (vendor_id) {
        query = query.eq('vendor_id', vendor_id);
        console.log('🔍 [SURCHARGE LIST] Applied vendor_id filter:', vendor_id);
      }

      if (contract_id) {
        query = query.eq('contract_id', contract_id);
        console.log('🔍 [SURCHARGE LIST] Applied contract_id filter:', contract_id);
      }

      if (charge_code) {
        query = query.eq('charge_code', charge_code);
        console.log('🔍 [SURCHARGE LIST] Applied charge_code filter:', charge_code);
      }

      if (container_type) {
        query = query.eq('container_type', container_type);
        console.log('🔍 [SURCHARGE LIST] Applied container_type filter:', container_type);
      }

      if (applies_scope) {
        query = query.eq('applies_scope', applies_scope);
        console.log('🔍 [SURCHARGE LIST] Applied applies_scope filter:', applies_scope);
      }

      // Order by ID (since created_at doesn't exist)
      query = query.order('id', { ascending: false });
      console.log('🔍 [SURCHARGE LIST] Applied ordering by ID');

      // Apply pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query = query.range(offset, offset + limitNum - 1);
      console.log('🔍 [SURCHARGE LIST] Applied pagination:', { pageNum, limitNum, offset });

      console.log('🔍 [SURCHARGE LIST] Executing query...');
      const { data, error } = await query;

      if (error) {
        console.error('❌ [SURCHARGE LIST] Database error:', error);
        throw error;
      }

      console.log('✅ [SURCHARGE LIST] Query successful, data count:', data?.length || 0);

      return reply.send({
        success: true,
        data: data || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          count: data?.length || 0
        }
      });

    } catch (error) {
      console.error('❌ [SURCHARGE LIST] Error:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==========================================
  // MARGIN RULE CRUD APIs
  // ==========================================

  // Create Margin Rule
  fastify.post('/api/margin-rules', async (request, reply) => {
    try {
      const { 
        level,
        pol_code,
        pod_code,
        tz_o,
        tz_d,
        mode,
        container_type,
        component_type,
        mark_kind,
        mark_value,
        valid_from,
        valid_to,
        priority
      } = request.body as any;

      // Validate required fields
      if (!level || !mark_kind || !mark_value) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: level, mark_kind, mark_value'
        });
      }

      // Get location IDs if pol_code/pod_code provided
      let polId = null;
      let podId = null;

      if (pol_code) {
        const { data: polData, error: polError } = await supabase
          .from('locations')
          .select('id')
          .eq('unlocode', pol_code)
          .eq('is_active', true)
          .single();

        if (polError || !polData) {
          return reply.status(404).send({
            success: false,
            error: `POL location not found: ${pol_code}`
          });
        }
        polId = polData.id;
      }

      if (pod_code) {
        const { data: podData, error: podError } = await supabase
          .from('locations')
          .select('id')
          .eq('unlocode', pod_code)
          .eq('is_active', true)
          .single();

        if (podError || !podData) {
          return reply.status(404).send({
            success: false,
            error: `POD location not found: ${pod_code}`
          });
        }
        podId = podData.id;
      }

      // Create the margin rule
      const { data, error } = await supabase
        .from('margin_rule_v2')
        .insert({
          level,
          pol_id: polId,
          pod_id: podId,
          tz_o,
          tz_d,
          mode,
          container_type,
          component_type,
          mark_kind,
          mark_value,
          valid_from: valid_from || new Date().toISOString().split('T')[0],
          valid_to: valid_to || '2099-12-31',
          priority: priority || 100,
          tenant_id: (request as any).tenant_id
        })
        .select(`
          id,
          level,
          pol_id,
          pod_id,
          tz_o,
          tz_d,
          mode,
          container_type,
          component_type,
          mark_kind,
          mark_value,
          valid_from,
          valid_to,
          priority,
          tenant_id
        `)
        .single();

      if (error) throw error;

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update Margin Rule
  fastify.put('/api/margin-rules/:ruleId', async (request, reply) => {
    try {
      const { ruleId } = request.params as any;
      const { 
        mark_value,
        valid_from,
        valid_to,
        priority
      } = request.body as any;

      const updates: any = {};

      if (mark_value !== undefined) updates.mark_value = mark_value;
      if (valid_from !== undefined) updates.valid_from = valid_from;
      if (valid_to !== undefined) updates.valid_to = valid_to;
      if (priority !== undefined) updates.priority = priority;

      const { data, error } = await supabase
        .from('margin_rule_v2')
        .update(updates)
        .eq('id', ruleId)
        .eq('tenant_id', (request as any).tenant_id)
        .select(`
          id,
          level,
          pol_id,
          pod_id,
          tz_o,
          tz_d,
          mode,
          container_type,
          component_type,
          mark_kind,
          mark_value,
          valid_from,
          valid_to,
          priority,
          tenant_id
        `)
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: 'Margin rule not found'
        });
      }

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get Single Margin Rule
  fastify.get('/api/margin-rules/:ruleId', async (request, reply) => {
    try {
      const { ruleId } = request.params as any;

      const { data, error } = await supabase
        .from('margin_rule_v2')
        .select(`
          id,
          level,
          pol_id,
          pod_id,
          tz_o,
          tz_d,
          mode,
          container_type,
          component_type,
          mark_kind,
          mark_value,
          valid_from,
          valid_to,
          priority,
          tenant_id
        `)
        .eq('id', ruleId)
        .eq('tenant_id', (request as any).tenant_id)
        .single();

      if (error) throw error;

      if (!data) {
        return reply.status(404).send({
          success: false,
          error: 'Margin rule not found'
        });
      }

      return reply.send({
        success: true,
        data: data
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List Margin Rules
  fastify.get('/api/margin-rules', async (request, reply) => {
    try {
      const { 
        level,
        mark_kind,
        component_type,
        page = 1,
        limit = 50
      } = request.query as any;

      const pageNum = parseInt(page) || 1;
      const limitNum = Math.min(parseInt(limit) || 50, 100);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('margin_rule_v2')
        .select(`
          id,
          level,
          pol_id,
          pod_id,
          tz_o,
          tz_d,
          mode,
          container_type,
          component_type,
          mark_kind,
          mark_value,
          valid_from,
          valid_to,
          priority,
          tenant_id
        `)
        .eq('tenant_id', (request as any).tenant_id)
        .order('priority', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limitNum - 1);

      // Apply filters
      if (level) query = query.eq('level', level);
      if (mark_kind) query = query.eq('mark_kind', mark_kind);
      if (component_type) query = query.eq('component_type', component_type);

      const { data, error } = await query;

      if (error) throw error;

      return reply.send({
        success: true,
        data: data || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          count: data?.length || 0
        }
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete Margin Rule
  fastify.delete('/api/margin-rules/:ruleId', async (request, reply) => {
    try {
      const { ruleId } = request.params as any;

      const { error } = await supabase
        .from('margin_rule_v2')
        .delete()
        .eq('id', ruleId)
        .eq('tenant_id', (request as any).tenant_id);

      if (error) throw error;

      return reply.send({
        success: true,
        message: `Margin rule ${ruleId} deleted successfully`
      });

    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add schedule routes (DCSA webhook, sync, etc.)
  addScheduleRoutes(fastify, supabase);

  // Add V4 API routes (search-rates and prepare-quote with origin/destination)
  addV4Routes(fastify, supabase);

  // Add schedule metrics/reporting routes
  addScheduleMetricsRoutes(fastify, supabase);

  return fastify;
}

async function main() {
  // Start MCP Server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RMS MCP Server running on stdio");
  console.error(`Connected to Supabase: ${SUPABASE_URL}`);

  // Start HTTP Server (only if environment variables are set)
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const httpServer = await createHttpServer();
    const port = process.env.PORT || 3000;
    
    try {
      await httpServer.listen({ port: Number(port), host: '0.0.0.0' });
      console.error(`HTTP API Server running on http://localhost:${port}`);
      console.error("Available endpoints:");
      console.error("  GET  /health");
      console.error("  POST /api/auth/token");
      console.error("  POST /api/search-rates");
      console.error("  POST /api/get-local-charges");
      console.error("  POST /api/prepare-quote");
      console.error("  POST /api/v2/search-rates");
      console.error("  POST /api/v2/prepare-quote");
      console.error("  POST /api/v3/prepare-quote");
      console.error("  POST /api/v3/get-inland-haulage");
      console.error("  POST /api/v4/search-rates");
      console.error("  POST /api/v4/prepare-quote");
      console.error("  POST /api/v4/schedules/search");
      console.error("  POST /api/ocean-freight-rates");
      console.error("  PUT  /api/ocean-freight-rates/:rateId");
      console.error("  GET  /api/ocean-freight-rates/:rateId");
      console.error("  GET  /api/ocean-freight-rates");
      console.error("  DELETE /api/ocean-freight-rates/:rateId");
      console.error("  POST /api/surcharges");
      console.error("  PUT  /api/surcharges/:surchargeId");
      console.error("  GET  /api/surcharges/:surchargeId");
      console.error("  GET  /api/surcharges");
      console.error("  DELETE /api/surcharges/:surchargeId");
      console.error("  POST /api/margin-rules");
      console.error("  PUT  /api/margin-rules/:ruleId");
      console.error("  GET  /api/margin-rules/:ruleId");
      console.error("  GET  /api/margin-rules");
      console.error("  DELETE /api/margin-rules/:ruleId");
    } catch (error) {
      console.error("Failed to start HTTP server:", error);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

