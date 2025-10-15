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
import cors from '@fastify/cors';
import jwt from 'jsonwebtoken';

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
    ],
  };
});

// ============================================
// TOOL IMPLEMENTATIONS
// ============================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ==========================================
    // 1. PRICING ENQUIRIES
    // ==========================================
    
    if (name === "price_enquiry") {
      const { pol_code, pod_code, container_type, container_count = 1 } = args as any;

      // Get location IDs
      const { data: polData } = await supabase
        .from('locations')
        .select('id')
        .eq('unlocode', pol_code)
        .single();

      const { data: podData } = await supabase
        .from('locations')
        .select('id')
        .eq('unlocode', pod_code)
        .single();

      if (!polData || !podData) {
        return {
          content: [{
            type: "text",
            text: `Error: Could not find locations for ${pol_code} or ${pod_code}`,
          }],
          isError: true,
        };
      }

      // Use the RMS function to get preferred rate
      const { data: rateData, error: rateError } = await supabase
        .rpc('rms_pick_ofr_preferred_only', {
          pol_id: polData.id,
          pod_id: podData.id,
          container_type: container_type,
        });

      if (rateError) throw rateError;

      // Get surcharges
      const { data: surcharges } = await supabase
        .from('v_surcharges')
        .select('*')
        .eq('pol_code', pol_code)
        .eq('pod_code', pod_code)
        .or(`container_type.eq.${container_type},container_type.is.null`);

      // Calculate totals
      const freightBuy = rateData?.buy_amount || 0;
      const surchargeTotal = surcharges?.reduce((sum: number, sc: any) => sum + (sc.amount || 0), 0) || 0;
      const totalBuy = (freightBuy + surchargeTotal) * container_count;

      // Apply margin using RMS function
      const { data: pricingResult, error: pricingError } = await supabase
        .rpc('apply_margin_allin_v2', {
          buy_total: totalBuy,
          mode: 'ocean',
          container_type: container_type,
          pol_id: polData.id,
          pod_id: podData.id,
          as_of: new Date().toISOString().split('T')[0],
        });

      if (pricingError) throw pricingError;

      const result = {
        route: {
          pol: pol_code,
          pod: pod_code,
          container_type: container_type,
          container_count: container_count,
        },
        vendor: rateData?.vendor_name || 'N/A',
        transit_days: rateData?.tt_days || 0,
        pricing: {
          freight_buy: freightBuy,
          surcharges_buy: surchargeTotal,
          buy_per_container: freightBuy + surchargeTotal,
          total_buy: totalBuy,
          total_sell: pricingResult?.sell_total || totalBuy,
          margin_amount: (pricingResult?.sell_total || totalBuy) - totalBuy,
          margin_pct: totalBuy > 0 ? (((pricingResult?.sell_total || totalBuy) - totalBuy) / totalBuy * 100).toFixed(2) : 0,
        },
        surcharges: surcharges?.map((sc: any) => ({
          charge_code: sc.charge_code,
          charge_name: sc.charge_name,
          amount: sc.amount,
          uom: sc.uom,
        })) || [],
        margin_rule_applied: pricingResult?.rule_info || 'Default',
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
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
      const formattedData = data?.map(rate => ({
        vendor: rate.carrier,
        route: `${rate.pol_name} (${rate.pol_code}) → ${rate.pod_name} (${rate.pod_code})`,
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

      let query = supabase
        .from('v_surcharges')
        .select('*')
        .eq('pol_code', pol_code)
        .eq('pod_code', pod_code);

      if (container_type) {
        query = query.or(`container_type.eq.${container_type},container_type.is.null`);
      }

      if (vendor_id) {
        query = query.eq('vendor_id', vendor_id);
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
        .from('locations')
        .select('id')
        .eq('unlocode', pol_code)
        .single();

      const { data: podData } = await supabase
        .from('locations')
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
          .from('locations')
          .select('id')
          .eq('unlocode', pol_code)
          .single();
        if (polData) insertData.pol_id = polData.id;
      }

      if (pod_code) {
        const { data: podData } = await supabase
          .from('locations')
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
        .from('locations')
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
        .from('locations')
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
        .from('locations')
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

    throw new Error(`Unknown tool: ${name}`);

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
    // Skip health check and auth endpoints
    if (request.url === '/health' || request.url === '/api/auth/token') return;

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

      // Format the response nicely
      const formattedData = data?.map(rate => ({
        vendor: rate.carrier,
        route: `${rate.pol_name} (${rate.pol_code}) → ${rate.pod_name} (${rate.pod_code})`,
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

      // Format the response nicely
      const formattedData = data?.map(rate => ({
        vendor: rate.carrier,
        route: `${rate.pol_name} (${rate.pol_code}) → ${rate.pod_name} (${rate.pod_code})`,
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
          const amountUSD = charge.charge_currency === 'USD' ? charge.charge_amount : charge.charge_amount / fxRate;
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
      console.error("  POST /api/v2/add-rate-to-quote");
      console.error("  POST /api/v2/get-quote-session");
      console.error("  POST /api/v2/prepare-quote");
    } catch (error) {
      console.error("Failed to start HTTP server:", error);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

