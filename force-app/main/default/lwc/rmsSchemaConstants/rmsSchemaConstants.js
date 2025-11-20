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
// VENDOR TYPES (must match database CHECK constraint)
// ==========================================
export const VENDOR_TYPES = [
    { label: 'Ocean Carrier', value: 'OCEAN_CARRIER' },
    { label: 'Freight Forwarder', value: 'FREIGHT_FORWARDER' },
    { label: 'Haulage (Road)', value: 'HAULAGE_ROAD' },
    { label: 'Haulage (Rail)', value: 'HAULAGE_RAIL' },
    { label: 'Haulage (Barge)', value: 'HAULAGE_BARGE' },
    { label: 'Air Carrier', value: 'AIR_CARRIER' },
    { label: 'Customs Broker', value: 'CUSTOMS_BROKER' }
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
    { label: 'Origin (POL Services)', value: 'origin' },
    { label: 'Port (POL Port Charges)', value: 'port' },
    { label: 'Freight (Ocean Leg)', value: 'freight' },
    { label: 'Destination (POD Services)', value: 'dest' },
    { label: 'Door (POD Door Delivery)', value: 'door' },
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
    vendor_type: { label: 'Type', type: 'picklist', required: true, options: VENDOR_TYPES },
    mode: { label: 'Mode', type: 'multiselect', required: false, options: [
        { label: 'Ocean', value: 'OCEAN' },
        { label: 'Air', value: 'AIR' },
        { label: 'Rail', value: 'RAIL' },
        { label: 'Truck', value: 'TRUCK' }
    ]},
    external_ref: { label: 'External Reference', type: 'text', required: false, maxLength: 255 }
};

export const CONTRACT_FIELDS = {
    vendor_id: { label: 'Vendor', type: 'lookup', required: true, relatedEntity: 'vendors' },
    name: { label: 'Contract Name', type: 'text', required: true, maxLength: 255 },
    contract_number: { label: 'Contract Number', type: 'text', required: false, maxLength: 100, readOnly: true },
    mode: { label: 'Mode', type: 'picklist', required: true, options: [
        { label: 'Ocean', value: 'ocean' },
        { label: 'Air', value: 'air' },
        { label: 'Rail', value: 'rail' },
        { label: 'Road', value: 'road' }
    ]},
    is_spot: { label: 'Spot Contract', type: 'checkbox', required: false, defaultValue: true },
    effective_from: { label: 'Effective From', type: 'date', required: true },
    effective_to: { label: 'Effective To', type: 'date', required: true },
    currency: { label: 'Currency', type: 'picklist', required: true, options: CURRENCY_CODES, defaultValue: 'USD' },
    source_ref: { label: 'Source Reference', type: 'text', required: false, maxLength: 255 },
    terms: { label: 'Terms (JSON)', type: 'textarea', required: false, placeholder: 'Enter JSON object or leave empty for {}' }
};

export const RATE_FIELDS = {
    contract_id: { label: 'Contract', type: 'lookup', required: true, relatedEntity: 'contracts' },
    origin_code: { label: 'Origin', type: 'portlookup', required: true, maxLength: 10, placeholder: 'e.g., INNSA' },
    destination_code: { label: 'Destination', type: 'portlookup', required: true, maxLength: 10, placeholder: 'e.g., NLRTM' },
    via_port_code: { label: 'Via Port (optional)', type: 'portlookup', required: false, maxLength: 10 },
    container_type: { label: 'Container Type', type: 'picklist', required: true, options: CONTAINER_TYPES },
    buy_amount: { label: 'Buy Amount', type: 'number', required: true, min: 0, step: 0.01 },
    currency: { label: 'Currency', type: 'picklist', required: true, options: CURRENCY_CODES, defaultValue: 'USD' },
    tt_days: { label: 'Transit Days', type: 'number', required: false, min: 0 },
    valid_from: { label: 'Valid From', type: 'date', required: true },
    valid_to: { label: 'Valid To', type: 'date', required: true },
    is_preferred: { label: 'Preferred', type: 'checkbox', required: false, defaultValue: false }
};

export const SURCHARGE_FIELDS = {
    vendor_id: { label: 'Vendor', type: 'lookup', required: true, relatedEntity: 'vendors' },
    contract_id: { label: 'Contract', type: 'lookup', required: true, relatedEntity: 'contracts' },
    charge_code: { label: 'Charge Code', type: 'chargelookup', required: true, maxLength: 50 },
    applies_scope: { label: 'Applies At', type: 'picklist', required: true, options: APPLIES_SCOPE_OPTIONS },
    pol_code: { label: 'POL (if origin/port or route-specific)', type: 'portlookup', required: false, maxLength: 10 },
    pod_code: { label: 'POD (if dest/door or route-specific)', type: 'portlookup', required: false, maxLength: 10 },
    uom: { label: 'Unit of Measure', type: 'picklist', required: true, options: UOM_OPTIONS, defaultValue: 'per_cntr' },
    amount: { label: 'Amount', type: 'number', required: true, min: 0, step: 0.01 },
    currency: { label: 'Currency', type: 'picklist', required: true, options: CURRENCY_CODES, defaultValue: 'USD' },
    calc_method: { label: 'Calculation Method', type: 'picklist', required: true, options: CALC_METHOD_OPTIONS, defaultValue: 'flat' },
    container_type: { label: 'Container Type (optional)', type: 'picklist', required: false, options: [{ label: 'All', value: '' }, ...CONTAINER_TYPES] },
    vendor_charge_code: { label: 'Vendor Charge Code', type: 'text', required: false, maxLength: 50 },
    vendor_charge_name: { label: 'Vendor Charge Name', type: 'text', required: false, maxLength: 255 },
    valid_from: { label: 'Valid From', type: 'date', required: false },
    valid_to: { label: 'Valid To', type: 'date', required: false }
};

export const MARGIN_RULE_FIELDS = {
    level: { label: 'Rule Level', type: 'picklist', required: true, options: MARGIN_RULE_LEVELS },
    pol_code: { label: 'Origin Port (for port_pair)', type: 'portlookup', required: false, maxLength: 10 },
    pod_code: { label: 'Destination Port (for port_pair)', type: 'portlookup', required: false, maxLength: 10 },
    tz_o: { label: 'Origin Trade Zone (for trade_zone)', type: 'text', required: false, maxLength: 50 },
    tz_d: { label: 'Destination Trade Zone (for trade_zone)', type: 'text', required: false, maxLength: 50 },
    mode: { label: 'Mode (optional)', type: 'picklist', required: false, options: [
        { label: 'Ocean', value: 'ocean' },
        { label: 'Air', value: 'air' },
        { label: 'Rail', value: 'rail' },
        { label: 'Road', value: 'road' }
    ]},
    container_type: { label: 'Container Type (optional)', type: 'picklist', required: false, options: [{ label: 'All', value: '' }, ...CONTAINER_TYPES] },
    component_type: { label: 'Component (optional)', type: 'picklist', required: false, options: [
        { label: 'Base Freight', value: 'base_freight' },
        { label: 'Total', value: 'total' }
    ]},
    mark_kind: { label: 'Markup Type', type: 'picklist', required: true, options: MARK_KIND_OPTIONS },
    mark_value: { label: 'Markup Value', type: 'number', required: true, min: 0, step: 0.0001 },
    priority: { label: 'Priority', type: 'number', required: true, min: 1, defaultValue: 100 },
    valid_from: { label: 'Valid From', type: 'date', required: true },
    valid_to: { label: 'Valid To', type: 'date', required: true }
};

// ==========================================
// HAULAGE - TRANSPORT MODES
// ==========================================
export const TRANSPORT_MODES = [
    { label: 'Road', value: 'ROAD' },
    { label: 'Rail', value: 'RAIL' },
    { label: 'Barge', value: 'BARGE' }
];

// ==========================================
// HAULAGE - RATE BASIS
// ==========================================
export const RATE_BASIS_OPTIONS = [
    { label: 'Per Container', value: 'PER_CONTAINER' },
    { label: 'Weight Slab', value: 'WEIGHT_SLAB' },
    { label: 'Per Kilogram', value: 'PER_KG' },
    { label: 'Per Ton', value: 'PER_TON' },
    { label: 'Per CBM', value: 'PER_CBM' },
    { label: 'Flat Rate', value: 'FLAT' }
];

// ==========================================
// HAULAGE - SERVICE FREQUENCY
// ==========================================
export const SERVICE_FREQUENCY_OPTIONS = [
    { label: 'Daily', value: 'Daily' },
    { label: 'Twice a Week', value: 'Twice a Week' },
    { label: 'Weekly', value: 'Weekly' },
    { label: 'Biweekly', value: 'Biweekly' },
    { label: 'Monthly', value: 'Monthly' },
    { label: 'On Demand', value: 'On Demand' }
];

// ==========================================
// HAULAGE RESPONSIBILITY - TERM CATEGORIES
// ==========================================
export const HAULAGE_TERM_CATEGORIES = [
    { label: 'Incoterm', value: 'INCOTERM' },
    { label: 'Custom', value: 'CUSTOM' },
    { label: 'Standard', value: 'STANDARD' }
];

export const HAULAGE_ARRANGED_BY_OPTIONS = [
    { label: 'Carrier', value: 'CARRIER' },
    { label: 'Merchant', value: 'MERCHANT' },
    { label: 'Forwarder', value: 'FORWARDER' }
];

export const HAULAGE_PAID_BY_OPTIONS = [
    { label: 'Carrier', value: 'CARRIER' },
    { label: 'Merchant', value: 'MERCHANT' },
    { label: 'Forwarder', value: 'FORWARDER' },
    { label: 'Consignee', value: 'CONSIGNEE' }
];

// ==========================================
// HAULAGE ROUTE FIELDS
// ==========================================
export const HAULAGE_ROUTE_FIELDS = {
    route_code: { label: 'Route Code', type: 'text', required: true, maxLength: 50 },
    route_name: { label: 'Route Name', type: 'text', required: false, maxLength: 255 },
    from_location_id: { label: 'From Location', type: 'portlookup', required: true, maxLength: 10 },
    to_location_id: { label: 'To Location', type: 'portlookup', required: true, maxLength: 10 },
    total_distance_km: { label: 'Total Distance (KM)', type: 'number', required: false, min: 0, step: 0.01 },
    avg_transit_days: { label: 'Avg Transit Days', type: 'number', required: false, min: 0 },
    service_frequency: { label: 'Service Frequency', type: 'picklist', required: false, options: SERVICE_FREQUENCY_OPTIONS },
    available_modes: { label: 'Available Modes', type: 'multiselect', required: false, options: TRANSPORT_MODES, defaultValue: ['ROAD'] },
    primary_mode: { label: 'Primary Mode', type: 'picklist', required: false, options: TRANSPORT_MODES, defaultValue: 'ROAD' },
    is_active: { label: 'Active', type: 'checkbox', required: false, defaultValue: true },
    notes: { label: 'Notes', type: 'textarea', required: false }
};

// ==========================================
// HAULAGE RATE FIELDS
// ==========================================
export const HAULAGE_RATE_FIELDS = {
    vendor_id: { label: 'Vendor', type: 'lookup', required: true, relatedEntity: 'vendors' },
    contract_id: { label: 'Contract', type: 'lookup', required: false, relatedEntity: 'contracts' },
    charge_code: { label: 'Charge Code', type: 'chargelookup', required: true, maxLength: 50 },
    route_id: { label: 'Route', type: 'lookup', required: true, relatedEntity: 'haulageRoutes' },
    leg_id: { label: 'Leg (optional)', type: 'lookup', required: false, relatedEntity: 'haulageLegs' },
    transport_mode: { label: 'Transport Mode', type: 'picklist', required: true, options: TRANSPORT_MODES },
    rate_basis: { label: 'Rate Basis', type: 'picklist', required: true, options: RATE_BASIS_OPTIONS },
    container_type: { label: 'Container Type', type: 'picklist', required: false, options: CONTAINER_TYPES },
    rate_per_container: { label: 'Rate Per Container', type: 'number', required: false, min: 0, step: 0.01 },
    min_weight_kg: { label: 'Min Weight (KG)', type: 'number', required: false, min: 0, step: 0.01 },
    max_weight_kg: { label: 'Max Weight (KG)', type: 'number', required: false, min: 0, step: 0.01 },
    rate_per_unit: { label: 'Rate Per Unit', type: 'number', required: false, min: 0, step: 0.01 },
    flat_rate: { label: 'Flat Rate', type: 'number', required: false, min: 0, step: 0.01 },
    currency: { label: 'Currency', type: 'picklist', required: true, options: CURRENCY_CODES, defaultValue: 'INR' },
    fuel_surcharge_pct: { label: 'Fuel Surcharge %', type: 'number', required: false, min: 0, step: 0.01, defaultValue: 0 },
    toll_charges: { label: 'Toll Charges', type: 'number', required: false, min: 0, step: 0.01, defaultValue: 0 },
    loading_charges: { label: 'Loading Charges', type: 'number', required: false, min: 0, step: 0.01, defaultValue: 0 },
    unloading_charges: { label: 'Unloading Charges', type: 'number', required: false, min: 0, step: 0.01, defaultValue: 0 },
    documentation_fee: { label: 'Documentation Fee', type: 'number', required: false, min: 0, step: 0.01, defaultValue: 0 },
    free_days: { label: 'Free Days', type: 'number', required: false, min: 0, defaultValue: 3 },
    detention_per_day: { label: 'Detention Per Day', type: 'number', required: false, min: 0, step: 0.01 },
    minimum_charge: { label: 'Minimum Charge', type: 'number', required: false, min: 0, step: 0.01 },
    valid_from: { label: 'Valid From', type: 'date', required: true },
    valid_to: { label: 'Valid To', type: 'date', required: true },
    is_active: { label: 'Active', type: 'checkbox', required: false, defaultValue: true },
    notes: { label: 'Notes', type: 'textarea', required: false }
};

// ==========================================
// HAULAGE LEG FIELDS
// ==========================================
export const HAULAGE_LEG_FIELDS = {
    route_id: { label: 'Route', type: 'lookup', required: true, relatedEntity: 'haulageRoutes' },
    leg_sequence: { label: 'Leg Sequence', type: 'number', required: true, min: 1 },
    leg_name: { label: 'Leg Name', type: 'text', required: false, maxLength: 255 },
    from_location_id: { label: 'From Location', type: 'portlookup', required: true, maxLength: 10 },
    to_location_id: { label: 'To Location', type: 'portlookup', required: true, maxLength: 10 },
    transport_mode: { label: 'Transport Mode', type: 'picklist', required: true, options: TRANSPORT_MODES },
    distance_km: { label: 'Distance (KM)', type: 'number', required: false, min: 0, step: 0.01 },
    transit_days: { label: 'Transit Days', type: 'number', required: false, min: 0 },
    via_point_id: { label: 'Via Point', type: 'portlookup', required: false, maxLength: 10 },
    notes: { label: 'Notes', type: 'textarea', required: false }
};

// ==========================================
// HAULAGE RESPONSIBILITY FIELDS
// ==========================================
export const HAULAGE_RESPONSIBILITY_FIELDS = {
    term_code: { label: 'Term Code', type: 'text', required: true, maxLength: 50 },
    term_name: { label: 'Term Name', type: 'text', required: true, maxLength: 255 },
    term_category: { label: 'Term Category', type: 'picklist', required: false, options: HAULAGE_TERM_CATEGORIES },
    description: { label: 'Description', type: 'textarea', required: false },
    ihe_arranged_by: { label: 'IHE Arranged By', type: 'picklist', required: true, options: HAULAGE_ARRANGED_BY_OPTIONS },
    ihe_paid_by: { label: 'IHE Paid By', type: 'picklist', required: true, options: HAULAGE_PAID_BY_OPTIONS },
    ihe_include_in_quote: { label: 'Include IHE in Quote', type: 'checkbox', required: false, defaultValue: true },
    ihi_arranged_by: { label: 'IHI Arranged By', type: 'picklist', required: true, options: HAULAGE_ARRANGED_BY_OPTIONS },
    ihi_paid_by: { label: 'IHI Paid By', type: 'picklist', required: true, options: HAULAGE_PAID_BY_OPTIONS },
    ihi_include_in_quote: { label: 'Include IHI in Quote', type: 'checkbox', required: false, defaultValue: true },
    common_usage: { label: 'Common Usage', type: 'text', required: false, maxLength: 255 },
    notes: { label: 'Notes', type: 'textarea', required: false },
    is_active: { label: 'Active', type: 'checkbox', required: false, defaultValue: true }
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
        marginRules: MARGIN_RULE_FIELDS,
        haulageRoutes: HAULAGE_ROUTE_FIELDS,
        haulageRates: HAULAGE_RATE_FIELDS,
        haulageLegs: HAULAGE_LEG_FIELDS,
        haulageResponsibilities: HAULAGE_RESPONSIBILITY_FIELDS
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
        marginRules: MARGIN_RULE_FIELDS,
        haulageRoutes: HAULAGE_ROUTE_FIELDS,
        haulageRates: HAULAGE_RATE_FIELDS,
        haulageLegs: HAULAGE_LEG_FIELDS,
        haulageResponsibilities: HAULAGE_RESPONSIBILITY_FIELDS
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
        marginRules: MARGIN_RULE_FIELDS,
        haulageRoutes: HAULAGE_ROUTE_FIELDS,
        haulageRates: HAULAGE_RATE_FIELDS,
        haulageLegs: HAULAGE_LEG_FIELDS,
        haulageResponsibilities: HAULAGE_RESPONSIBILITY_FIELDS
    };
    return fieldConfigs[entityType] || {};
}

