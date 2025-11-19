/**
 * RMS Schema Constants
 * Centralized definitions of enums, constraints, and field configurations
 * for alignment between UI and data model
 */

// ==========================================
// CONTAINER TYPES
// ==========================================
export const CONTAINER_TYPES = [
    { label: '20GP - 20ft General Purpose', value: '20GP' },
    { label: '40GP - 40ft General Purpose', value: '40GP' },
    { label: '40HC - 40ft High Cube', value: '40HC' },
    { label: '45HC - 45ft High Cube', value: '45HC' },
    { label: '20RF - 20ft Reefer', value: '20RF' },
    { label: '40RF - 40ft Reefer', value: '40RF' },
    { label: '40HR - 40ft High Cube Reefer', value: '40HR' },
    { label: '20OT - 20ft Open Top', value: '20OT' },
    { label: '40OT - 40ft Open Top', value: '40OT' },
    { label: '20FT - 20ft Flat Rack', value: '20FT' },
    { label: '40FT - 40ft Flat Rack', value: '40FT' },
    { label: 'LCL - Less than Container Load', value: 'LCL' }
];

// ==========================================
// CURRENCY CODES
// ==========================================
export const CURRENCY_CODES = [
    { label: 'USD - US Dollar', value: 'USD' },
    { label: 'EUR - Euro', value: 'EUR' },
    { label: 'GBP - British Pound', value: 'GBP' },
    { label: 'INR - Indian Rupee', value: 'INR' },
    { label: 'AED - UAE Dirham', value: 'AED' },
    { label: 'CNY - Chinese Yuan', value: 'CNY' },
    { label: 'JPY - Japanese Yen', value: 'JPY' },
    { label: 'SGD - Singapore Dollar', value: 'SGD' },
    { label: 'HKD - Hong Kong Dollar', value: 'HKD' },
    { label: 'AUD - Australian Dollar', value: 'AUD' }
];

// ==========================================
// VENDOR TYPES
// ==========================================
export const VENDOR_TYPES = [
    { label: 'Ocean Carrier', value: 'ocean_carrier' },
    { label: 'Forwarder', value: 'forwarder' },
    { label: 'Trucking Company', value: 'trucking' },
    { label: 'Rail Company', value: 'rail' },
    { label: 'Warehouse', value: 'warehouse' },
    { label: 'Customs Broker', value: 'customs_broker' },
    { label: 'Other', value: 'other' }
];

// ==========================================
// CHARGE CODES (Surcharges)
// ==========================================
export const CHARGE_CODES = [
    { label: 'THC - Terminal Handling Charge', value: 'THC' },
    { label: 'BAF - Bunker Adjustment Factor', value: 'BAF' },
    { label: 'CAF - Currency Adjustment Factor', value: 'CAF' },
    { label: 'DOC - Documentation Fee', value: 'DOC' },
    { label: 'AMS - Automated Manifest System', value: 'AMS' },
    { label: 'ENS - Entry Summary Declaration', value: 'ENS' },
    { label: 'ISPS - International Ship and Port Facility Security', value: 'ISPS' },
    { label: 'PSS - Peak Season Surcharge', value: 'PSS' },
    { label: 'CIC - Container Imbalance Charge', value: 'CIC' },
    { label: 'DDC - Destination Delivery Charge', value: 'DDC' },
    { label: 'ORC - Origin Receiving Charge', value: 'ORC' },
    { label: 'BUC - Bunker Charge', value: 'BUC' },
    { label: 'WRS - War Risk Surcharge', value: 'WRS' },
    { label: 'SEC - Security Surcharge', value: 'SEC' },
    { label: 'EBS - Emergency Bunker Surcharge', value: 'EBS' },
    { label: 'Other', value: 'OTHER' }
];

// ==========================================
// APPLIES SCOPE (Surcharges)
// ==========================================
export const APPLIES_SCOPE_OPTIONS = [
    { label: 'Origin', value: 'origin' },
    { label: 'Port', value: 'port' },
    { label: 'Freight', value: 'freight' },
    { label: 'Destination', value: 'dest' },
    { label: 'Door', value: 'door' },
    { label: 'Other', value: 'other' }
];

// ==========================================
// UOM (Unit of Measure) - Surcharges
// ==========================================
export const UOM_OPTIONS = [
    { label: 'Per Container', value: 'per_cntr' },
    { label: 'Per Bill of Lading', value: 'per_bl' },
    { label: 'Per Shipment', value: 'per_shipment' },
    { label: 'Per Kilogram', value: 'per_kg' },
    { label: 'Per Cubic Meter', value: 'per_cbm' }
];

// ==========================================
// CALCULATION METHOD - Surcharges
// ==========================================
export const CALC_METHOD_OPTIONS = [
    { label: 'Flat', value: 'flat' },
    { label: 'Percentage', value: 'percentage' },
    { label: 'Tier', value: 'tier' }
];

// ==========================================
// MARGIN RULE LEVEL
// ==========================================
export const MARGIN_RULE_LEVELS = [
    { label: 'Global', value: 'global' },
    { label: 'Trade Zone', value: 'trade_zone' },
    { label: 'Port Pair', value: 'port_pair' }
];

// ==========================================
// MARK KIND (Margin Rules)
// ==========================================
export const MARK_KIND_OPTIONS = [
    { label: 'Percentage', value: 'pct' },
    { label: 'Flat Amount', value: 'flat' }
];

// ==========================================
// FIELD CONFIGURATIONS
// ==========================================

export const VENDOR_FIELDS = {
    name: { label: 'Name', type: 'text', required: true, maxLength: 255 },
    alias: { label: 'Alias', type: 'text', required: false, maxLength: 255 },
    type: { label: 'Type', type: 'picklist', required: true, options: VENDOR_TYPES },
    is_active: { label: 'Active', type: 'checkbox', required: false, defaultValue: true }
};

export const CONTRACT_FIELDS = {
    vendor_id: { label: 'Vendor ID', type: 'number', required: true },
    contract_number: { label: 'Contract Number', type: 'text', required: false, maxLength: 100 },
    valid_from: { label: 'Valid From', type: 'date', required: true },
    valid_to: { label: 'Valid To', type: 'date', required: true },
    is_active: { label: 'Active', type: 'checkbox', required: false, defaultValue: true }
};

export const RATE_FIELDS = {
    contract_id: { label: 'Contract ID', type: 'number', required: true },
    origin_code: { label: 'Origin Code', type: 'text', required: true, maxLength: 10, placeholder: 'e.g., INNSA' },
    destination_code: { label: 'Destination Code', type: 'text', required: true, maxLength: 10, placeholder: 'e.g., NLRTM' },
    container_type: { label: 'Container Type', type: 'picklist', required: true, options: CONTAINER_TYPES },
    buy_amount: { label: 'Buy Amount', type: 'number', required: true, min: 0, step: 0.01 },
    currency: { label: 'Currency', type: 'picklist', required: true, options: CURRENCY_CODES, defaultValue: 'USD' },
    tt_days: { label: 'Transit Days', type: 'number', required: false, min: 0 },
    valid_from: { label: 'Valid From', type: 'date', required: true },
    valid_to: { label: 'Valid To', type: 'date', required: true },
    is_preferred: { label: 'Preferred', type: 'checkbox', required: false, defaultValue: false }
};

export const SURCHARGE_FIELDS = {
    vendor_id: { label: 'Vendor ID', type: 'number', required: true },
    contract_id: { label: 'Contract ID', type: 'number', required: true },
    charge_code: { label: 'Charge Code', type: 'picklist', required: true, options: CHARGE_CODES },
    amount: { label: 'Amount', type: 'number', required: true, min: 0, step: 0.01 },
    currency: { label: 'Currency', type: 'picklist', required: true, options: CURRENCY_CODES, defaultValue: 'USD' },
    uom: { label: 'Unit of Measure', type: 'picklist', required: true, options: UOM_OPTIONS, defaultValue: 'per_cntr' },
    calc_method: { label: 'Calculation Method', type: 'picklist', required: true, options: CALC_METHOD_OPTIONS, defaultValue: 'flat' },
    applies_scope: { label: 'Applies Scope', type: 'picklist', required: true, options: APPLIES_SCOPE_OPTIONS, defaultValue: 'freight' },
    pol_code: { label: 'POL Code (optional)', type: 'text', required: false, maxLength: 10 },
    pod_code: { label: 'POD Code (optional)', type: 'text', required: false, maxLength: 10 },
    container_type: { label: 'Container Type (optional)', type: 'picklist', required: false, options: [{ label: 'All', value: '' }, ...CONTAINER_TYPES] },
    valid_from: { label: 'Valid From', type: 'date', required: true },
    valid_to: { label: 'Valid To', type: 'date', required: true },
    is_active: { label: 'Active', type: 'checkbox', required: false, defaultValue: true }
};

export const MARGIN_RULE_FIELDS = {
    level: { label: 'Level', type: 'picklist', required: true, options: MARGIN_RULE_LEVELS },
    pol_code: { label: 'POL Code (for port_pair)', type: 'text', required: false, maxLength: 10 },
    pod_code: { label: 'POD Code (for port_pair)', type: 'text', required: false, maxLength: 10 },
    mark_kind: { label: 'Mark Kind', type: 'picklist', required: true, options: MARK_KIND_OPTIONS },
    mark_value: { label: 'Mark Value', type: 'number', required: true, min: 0, step: 0.0001 },
    priority: { label: 'Priority', type: 'number', required: true, min: 1, defaultValue: 100 },
    valid_from: { label: 'Valid From', type: 'date', required: true },
    valid_to: { label: 'Valid To', type: 'date', required: true }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export function getFieldConfig(entityType, fieldName) {
    const fieldConfigs = {
        vendors: VENDOR_FIELDS,
        contracts: CONTRACT_FIELDS,
        rates: RATE_FIELDS,
        oceanFreight: RATE_FIELDS, // Ocean Freight uses same fields as rates
        surcharges: SURCHARGE_FIELDS,
        marginRules: MARGIN_RULE_FIELDS
    };
    return fieldConfigs[entityType]?.[fieldName];
}

export function getPicklistOptions(entityType, fieldName) {
    const field = getFieldConfig(entityType, fieldName);
    return field?.options || [];
}

export function getRequiredFields(entityType) {
    const fieldConfigs = {
        vendors: VENDOR_FIELDS,
        contracts: CONTRACT_FIELDS,
        rates: RATE_FIELDS,
        oceanFreight: RATE_FIELDS, // Ocean Freight uses same fields as rates
        surcharges: SURCHARGE_FIELDS,
        marginRules: MARGIN_RULE_FIELDS
    };
    const fields = fieldConfigs[entityType] || {};
    return Object.keys(fields).filter(key => fields[key].required);
}

// Get all fields for an entity type
export function getAllFields(entityType) {
    const fieldConfigs = {
        vendors: VENDOR_FIELDS,
        contracts: CONTRACT_FIELDS,
        rates: RATE_FIELDS,
        oceanFreight: RATE_FIELDS,
        surcharges: SURCHARGE_FIELDS,
        marginRules: MARGIN_RULE_FIELDS
    };
    return fieldConfigs[entityType] || {};
}

