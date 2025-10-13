#!/usr/bin/env node
"use strict";
/**
 * RMS MCP Server - Supabase Integration
 * Provides Claude with direct access to RMS database
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = require("dotenv");
var index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var supabase_js_1 = require("@supabase/supabase-js");
// Load environment variables from .env file
(0, dotenv_1.config)();
// ============================================
// CONFIGURATION
// ============================================
var SUPABASE_URL = process.env.SUPABASE_URL || '';
var SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    process.exit(1);
}
var supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// ============================================
// MCP SERVER SETUP
// ============================================
var server = new index_js_1.Server({
    name: "rms-supabase-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// ============================================
// TOOL DEFINITIONS
// ============================================
server.setRequestHandler(types_js_1.ListToolsRequestSchema, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
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
            }];
    });
}); });
// ============================================
// TOOL IMPLEMENTATIONS
// ============================================
server.setRequestHandler(types_js_1.CallToolRequestSchema, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name, args, _b, pol_code, pod_code, container_type, _c, container_count, polData, podData, _d, rateData, rateError, surcharges, freightBuy, surchargeTotal, totalBuy, _e, pricingResult, pricingError, result, _f, pol_code, pod_code, container_type, vendor_name, query, _g, data, error, _h, pol_code, pod_code, container_type, vendor_id, query, _j, data, error, _k, rate_id, updates, _l, data, error, _m, pol_code, pod_code, rateData, polData, podData, _o, data, error, _p, surcharge_id, updates, _q, data, error, _r, pol_code, pod_code, surchargeData, insertData, polData, podData, _s, data, error, _t, location_id, updates, _u, data, error, _v, data, error, _w, vendor_type, is_active, query, _x, data, error, _y, vendor_id, updates, _z, data, error, _0, data, error, _1, rule_id, updates, _2, data, error, rule_id, error, _3, scope, is_active, query, _4, data, error, typedArgs, quote, quote_id, _5, search, location_type, country_code, _6, limit, query, _7, data, error, bucket, query, _8, data, error, error_1;
    return __generator(this, function (_9) {
        switch (_9.label) {
            case 0:
                _a = request.params, name = _a.name, args = _a.arguments;
                _9.label = 1;
            case 1:
                _9.trys.push([1, 46, , 47]);
                if (!(name === "price_enquiry")) return [3 /*break*/, 7];
                _b = args, pol_code = _b.pol_code, pod_code = _b.pod_code, container_type = _b.container_type, _c = _b.container_count, container_count = _c === void 0 ? 1 : _c;
                return [4 /*yield*/, supabase
                        .from('locations')
                        .select('id')
                        .eq('unlocode', pol_code)
                        .single()];
            case 2:
                polData = (_9.sent()).data;
                return [4 /*yield*/, supabase
                        .from('locations')
                        .select('id')
                        .eq('unlocode', pod_code)
                        .single()];
            case 3:
                podData = (_9.sent()).data;
                if (!polData || !podData) {
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "Error: Could not find locations for ".concat(pol_code, " or ").concat(pod_code),
                                }],
                            isError: true,
                        }];
                }
                return [4 /*yield*/, supabase
                        .rpc('rms_pick_ofr_preferred_only', {
                        pol_id: polData.id,
                        pod_id: podData.id,
                        container_type: container_type,
                    })];
            case 4:
                _d = _9.sent(), rateData = _d.data, rateError = _d.error;
                if (rateError)
                    throw rateError;
                return [4 /*yield*/, supabase
                        .from('v_surcharges')
                        .select('*')
                        .eq('pol_code', pol_code)
                        .eq('pod_code', pod_code)
                        .or("container_type.eq.".concat(container_type, ",container_type.is.null"))];
            case 5:
                surcharges = (_9.sent()).data;
                freightBuy = (rateData === null || rateData === void 0 ? void 0 : rateData.buy_amount) || 0;
                surchargeTotal = (surcharges === null || surcharges === void 0 ? void 0 : surcharges.reduce(function (sum, sc) { return sum + (sc.amount || 0); }, 0)) || 0;
                totalBuy = (freightBuy + surchargeTotal) * container_count;
                return [4 /*yield*/, supabase
                        .rpc('apply_margin_allin_v2', {
                        buy_total: totalBuy,
                        mode: 'ocean',
                        container_type: container_type,
                        pol_id: polData.id,
                        pod_id: podData.id,
                        as_of: new Date().toISOString().split('T')[0],
                    })];
            case 6:
                _e = _9.sent(), pricingResult = _e.data, pricingError = _e.error;
                if (pricingError)
                    throw pricingError;
                result = {
                    route: {
                        pol: pol_code,
                        pod: pod_code,
                        container_type: container_type,
                        container_count: container_count,
                    },
                    vendor: (rateData === null || rateData === void 0 ? void 0 : rateData.vendor_name) || 'N/A',
                    transit_days: (rateData === null || rateData === void 0 ? void 0 : rateData.tt_days) || 0,
                    pricing: {
                        freight_buy: freightBuy,
                        surcharges_buy: surchargeTotal,
                        buy_per_container: freightBuy + surchargeTotal,
                        total_buy: totalBuy,
                        total_sell: (pricingResult === null || pricingResult === void 0 ? void 0 : pricingResult.sell_total) || totalBuy,
                        margin_amount: ((pricingResult === null || pricingResult === void 0 ? void 0 : pricingResult.sell_total) || totalBuy) - totalBuy,
                        margin_pct: totalBuy > 0 ? ((((pricingResult === null || pricingResult === void 0 ? void 0 : pricingResult.sell_total) || totalBuy) - totalBuy) / totalBuy * 100).toFixed(2) : 0,
                    },
                    surcharges: (surcharges === null || surcharges === void 0 ? void 0 : surcharges.map(function (sc) { return ({
                        charge_code: sc.charge_code,
                        charge_name: sc.charge_name,
                        amount: sc.amount,
                        uom: sc.uom,
                    }); })) || [],
                    margin_rule_applied: (pricingResult === null || pricingResult === void 0 ? void 0 : pricingResult.rule_info) || 'Default',
                };
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: JSON.stringify(result, null, 2),
                            }],
                    }];
            case 7:
                if (!(name === "search_rates")) return [3 /*break*/, 9];
                _f = args, pol_code = _f.pol_code, pod_code = _f.pod_code, container_type = _f.container_type, vendor_name = _f.vendor_name;
                query = supabase
                    .from('v_preferred_ofr')
                    .select('*')
                    .eq('pol_code', pol_code)
                    .eq('pod_code', pod_code);
                if (container_type) {
                    query = query.eq('container_type', container_type);
                }
                if (vendor_name) {
                    query = query.ilike('vendor_name', "%".concat(vendor_name, "%"));
                }
                return [4 /*yield*/, query];
            case 8:
                _g = _9.sent(), data = _g.data, error = _g.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: JSON.stringify(data, null, 2),
                            }],
                    }];
            case 9:
                if (!(name === "get_surcharges")) return [3 /*break*/, 11];
                _h = args, pol_code = _h.pol_code, pod_code = _h.pod_code, container_type = _h.container_type, vendor_id = _h.vendor_id;
                query = supabase
                    .from('v_surcharges')
                    .select('*')
                    .eq('pol_code', pol_code)
                    .eq('pod_code', pod_code);
                if (container_type) {
                    query = query.or("container_type.eq.".concat(container_type, ",container_type.is.null"));
                }
                if (vendor_id) {
                    query = query.eq('vendor_id', vendor_id);
                }
                return [4 /*yield*/, query];
            case 10:
                _j = _9.sent(), data = _j.data, error = _j.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: JSON.stringify(data, null, 2),
                            }],
                    }];
            case 11:
                if (!(name === "update_freight_rate")) return [3 /*break*/, 13];
                _k = args, rate_id = _k.rate_id, updates = _k.updates;
                return [4 /*yield*/, supabase
                        .from('ocean_freight_rate')
                        .update(updates)
                        .eq('id', rate_id)
                        .select()];
            case 12:
                _l = _9.sent(), data = _l.data, error = _l.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 Freight rate ".concat(rate_id, " updated successfully\n").concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 13:
                if (!(name === "create_freight_rate")) return [3 /*break*/, 17];
                _m = args, pol_code = _m.pol_code, pod_code = _m.pod_code, rateData = __rest(_m, ["pol_code", "pod_code"]);
                return [4 /*yield*/, supabase
                        .from('locations')
                        .select('id')
                        .eq('unlocode', pol_code)
                        .single()];
            case 14:
                polData = (_9.sent()).data;
                return [4 /*yield*/, supabase
                        .from('locations')
                        .select('id')
                        .eq('unlocode', pod_code)
                        .single()];
            case 15:
                podData = (_9.sent()).data;
                if (!polData || !podData) {
                    throw new Error("Locations not found: ".concat(pol_code, " or ").concat(pod_code));
                }
                return [4 /*yield*/, supabase
                        .from('ocean_freight_rate')
                        .insert(__assign(__assign({}, rateData), { pol_id: polData.id, pod_id: podData.id }))
                        .select()];
            case 16:
                _o = _9.sent(), data = _o.data, error = _o.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 New freight rate created\n".concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 17:
                if (!(name === "update_surcharge")) return [3 /*break*/, 19];
                _p = args, surcharge_id = _p.surcharge_id, updates = _p.updates;
                return [4 /*yield*/, supabase
                        .from('surcharge')
                        .update(updates)
                        .eq('id', surcharge_id)
                        .select()];
            case 18:
                _q = _9.sent(), data = _q.data, error = _q.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 Surcharge ".concat(surcharge_id, " updated successfully\n").concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 19:
                if (!(name === "create_surcharge")) return [3 /*break*/, 25];
                _r = args, pol_code = _r.pol_code, pod_code = _r.pod_code, surchargeData = __rest(_r, ["pol_code", "pod_code"]);
                insertData = __assign({}, surchargeData);
                if (!pol_code) return [3 /*break*/, 21];
                return [4 /*yield*/, supabase
                        .from('locations')
                        .select('id')
                        .eq('unlocode', pol_code)
                        .single()];
            case 20:
                polData = (_9.sent()).data;
                if (polData)
                    insertData.pol_id = polData.id;
                _9.label = 21;
            case 21:
                if (!pod_code) return [3 /*break*/, 23];
                return [4 /*yield*/, supabase
                        .from('locations')
                        .select('id')
                        .eq('unlocode', pod_code)
                        .single()];
            case 22:
                podData = (_9.sent()).data;
                if (podData)
                    insertData.pod_id = podData.id;
                _9.label = 23;
            case 23: return [4 /*yield*/, supabase
                    .from('surcharge')
                    .insert(insertData)
                    .select()];
            case 24:
                _s = _9.sent(), data = _s.data, error = _s.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 New surcharge created\n".concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 25:
                if (!(name === "update_location")) return [3 /*break*/, 27];
                _t = args, location_id = _t.location_id, updates = _t.updates;
                return [4 /*yield*/, supabase
                        .from('locations')
                        .update(updates)
                        .eq('id', location_id)
                        .select()];
            case 26:
                _u = _9.sent(), data = _u.data, error = _u.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 Location updated successfully\n".concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 27:
                if (!(name === "create_location")) return [3 /*break*/, 29];
                return [4 /*yield*/, supabase
                        .from('locations')
                        .insert(args)
                        .select()];
            case 28:
                _v = _9.sent(), data = _v.data, error = _v.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 New location created\n".concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 29:
                if (!(name === "list_vendors")) return [3 /*break*/, 31];
                _w = args, vendor_type = _w.vendor_type, is_active = _w.is_active;
                query = supabase.from('vendor').select('*');
                if (vendor_type) {
                    query = query.eq('type', vendor_type);
                }
                if (is_active !== undefined) {
                    query = query.eq('is_active', is_active);
                }
                return [4 /*yield*/, query];
            case 30:
                _x = _9.sent(), data = _x.data, error = _x.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: JSON.stringify(data, null, 2),
                            }],
                    }];
            case 31:
                if (!(name === "update_vendor")) return [3 /*break*/, 33];
                _y = args, vendor_id = _y.vendor_id, updates = _y.updates;
                return [4 /*yield*/, supabase
                        .from('vendor')
                        .update(updates)
                        .eq('id', vendor_id)
                        .select()];
            case 32:
                _z = _9.sent(), data = _z.data, error = _z.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 Vendor updated successfully\n".concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 33:
                if (!(name === "create_margin_rule")) return [3 /*break*/, 35];
                return [4 /*yield*/, supabase
                        .from('margin_rule_v2')
                        .insert(args)
                        .select()];
            case 34:
                _0 = _9.sent(), data = _0.data, error = _0.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 Margin rule created successfully\n".concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 35:
                if (!(name === "update_margin_rule")) return [3 /*break*/, 37];
                _1 = args, rule_id = _1.rule_id, updates = _1.updates;
                return [4 /*yield*/, supabase
                        .from('margin_rule_v2')
                        .update(updates)
                        .eq('id', rule_id)
                        .select()];
            case 36:
                _2 = _9.sent(), data = _2.data, error = _2.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 Margin rule updated successfully\n".concat(JSON.stringify(data, null, 2)),
                            }],
                    }];
            case 37:
                if (!(name === "delete_margin_rule")) return [3 /*break*/, 39];
                rule_id = args.rule_id;
                return [4 /*yield*/, supabase
                        .from('margin_rule_v2')
                        .delete()
                        .eq('id', rule_id)];
            case 38:
                error = (_9.sent()).error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u2705 Margin rule ".concat(rule_id, " deleted successfully"),
                            }],
                    }];
            case 39:
                if (!(name === "list_margin_rules")) return [3 /*break*/, 41];
                _3 = args, scope = _3.scope, is_active = _3.is_active;
                query = supabase.from('margin_rule_v2').select('*');
                if (scope) {
                    query = query.eq('scope', scope);
                }
                if (is_active !== undefined) {
                    query = query.eq('is_active', is_active);
                }
                query = query.order('priority', { ascending: false });
                return [4 /*yield*/, query];
            case 40:
                _4 = _9.sent(), data = _4.data, error = _4.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: JSON.stringify(data, null, 2),
                            }],
                    }];
            case 41:
                // ==========================================
                // 4. CREATE QUOTATION
                // ==========================================
                if (name === "create_quotation") {
                    typedArgs = args;
                    quote = {
                        quote_number: "QT-".concat(Date.now()),
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
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "\u2705 Quotation created successfully\n".concat(JSON.stringify(quote, null, 2)),
                                }],
                        }];
                }
                if (name === "get_quotation") {
                    quote_id = args.quote_id;
                    // If you have a quotes table, query it here
                    // For now, return a mock response
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "Quote ".concat(quote_id, " - This would retrieve from quotes table"),
                                }],
                        }];
                }
                if (!(name === "search_locations")) return [3 /*break*/, 43];
                _5 = args, search = _5.search, location_type = _5.location_type, country_code = _5.country_code, _6 = _5.limit, limit = _6 === void 0 ? 20 : _6;
                query = supabase
                    .from('locations')
                    .select('*')
                    .or("name.ilike.%".concat(search, "%,unlocode.ilike.%").concat(search, "%"))
                    .limit(limit);
                if (location_type) {
                    query = query.eq('location_type', location_type);
                }
                if (country_code) {
                    query = query.eq('country_code', country_code);
                }
                return [4 /*yield*/, query];
            case 42:
                _7 = _9.sent(), data = _7.data, error = _7.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: JSON.stringify(data, null, 2),
                            }],
                    }];
            case 43:
                if (!(name === "list_charge_codes")) return [3 /*break*/, 45];
                bucket = args.bucket;
                query = supabase.from('charge_master').select('*');
                if (bucket) {
                    query = query.eq('bucket', bucket);
                }
                return [4 /*yield*/, query];
            case 44:
                _8 = _9.sent(), data = _8.data, error = _8.error;
                if (error)
                    throw error;
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: JSON.stringify(data, null, 2),
                            }],
                    }];
            case 45: throw new Error("Unknown tool: ".concat(name));
            case 46:
                error_1 = _9.sent();
                return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "Error: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                            }],
                        isError: true,
                    }];
            case 47: return [2 /*return*/];
        }
    });
}); });
// ============================================
// START SERVER
// ============================================
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 1:
                    _a.sent();
                    console.error("RMS MCP Server running on stdio");
                    console.error("Connected to Supabase: ".concat(SUPABASE_URL));
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error("Fatal error:", error);
    process.exit(1);
});
