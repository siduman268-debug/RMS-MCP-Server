# Database Schema Analysis - RMS Tables

## 🎯 **OCEAN FREIGHT RATE TABLE**

### **Required Fields (NOT NULL):**
- `id` (bigint) - Auto-generated
- `contract_id` (bigint) - Foreign key to `rate_contract`
- `pol_id` (uuid) - Foreign key to `locations`
- `pod_id` (uuid) - Foreign key to `locations`
- `container_type` (text) - Foreign key to `ref_container_type`
- `buy_amount` (numeric(12,2)) - **NOT `rate_amount`**
- `currency` (text) - Foreign key to `ref_currency`
- `is_preferred` (boolean) - Default: false
- `tenant_id` (uuid) - Foreign key to `tenants`

### **Optional Fields:**
- `tt_days` (integer) - Transit days
- `via_port_id` (uuid) - Foreign key to `locations`
- `valid_from` (date)
- `valid_to` (date)

### **Constraints:**
- **Unique Constraint**: `contract_id + pol_id + pod_id + container_type` (composite key)
- **Foreign Keys**: 
  - `contract_id` → `rate_contract.id`
  - `pol_id` → `locations.id`
  - `pod_id` → `locations.id`
  - `container_type` → `ref_container_type.code`
  - `currency` → `ref_currency.code`
  - `via_port_id` → `locations.id`
  - `tenant_id` → `tenants.id`

### **Indexes:**
- **Primary Key**: `id` (unique)
- **Unique Index**: `contract_id + pol_id + pod_id + container_type` (business rule)
- **Unique Index**: `pol_id + pod_id + container_type` WHERE `is_preferred = true` (only one preferred per lane)
- **Performance Indexes**: `tenant_id`, `pol_id + pod_id + container_type`, `valid_from + valid_to`, `is_preferred`

---

## 🎯 **SURCHARGE TABLE**

### **Required Fields (NOT NULL):**
- `id` (bigint) - Auto-generated
- `contract_id` (bigint) - Foreign key to `rate_contract`
- `charge_code` (text) - Foreign key to `charge_master.charge_code`
- `applies_scope` (text) - **CHECK constraint**: `['origin', 'port', 'freight', 'dest', 'door', 'other']`
- `uom` (text) - **CHECK constraint**: `['per_cntr', 'per_bl', 'per_shipment', 'per_kg', 'per_cbm']`
- `amount` (numeric(12,3)) - **NOT `rate_amount`**
- `currency` (text) - Foreign key to `ref_currency`
- `calc_method` (text) - **CHECK constraint**: `['flat', 'percentage', 'tier']`
- `vendor_id` (bigint) - **NOT NULL**
- `tenant_id` (uuid) - Foreign key to `tenants`

### **Optional Fields:**
- `pol_id` (uuid) - Foreign key to `locations`
- `pod_id` (uuid) - Foreign key to `locations`
- `container_type` (text) - Foreign key to `ref_container_type`
- `equipment_type` (text)
- `air_slab_min` (numeric)
- `air_slab_max` (numeric)
- `vendor_charge_code` (text)
- `vendor_charge_name` (text)
- `valid_from` (date)
- `valid_to` (date)
- `location_id` (uuid) - Foreign key to `locations`
- `is_active` (boolean) - Default: true

### **Constraints:**
- **CHECK Constraints**:
  - `applies_scope` ∈ `['origin', 'port', 'freight', 'dest', 'door', 'other']`
  - `uom` ∈ `['per_cntr', 'per_bl', 'per_shipment', 'per_kg', 'per_cbm']`
  - `calc_method` ∈ `['flat', 'percentage', 'tier']`
  - `air_slab_min < air_slab_max` (if both provided)
- **Foreign Keys**:
  - `charge_code` → `charge_master.charge_code`
  - `contract_id` → `rate_contract.id`
  - `currency` → `ref_currency.code`
  - `pol_id` → `locations.id`
  - `pod_id` → `locations.id`
  - `container_type` → `ref_container_type.code`
  - `location_id` → `locations.id`
  - `tenant_id` → `tenants.id`

### **Indexes:**
- **Primary Key**: `id` (unique)
- **Performance Indexes**: 
  - `tenant_id`
  - `charge_code + applies_scope + pol_id + pod_id + container_type` (filtering)
  - `vendor_id + applies_scope`
  - `pol_id` WHERE `applies_scope = 'POL'`
  - `pod_id` WHERE `applies_scope = 'POD'`
  - `valid_from + valid_to`
  - `is_active` WHERE `is_active = true`

---

## 🎯 **LOCATIONS TABLE**

### **Required Fields (NOT NULL):**
- `id` (uuid) - Auto-generated with `gen_random_uuid()`
- `location_code` (varchar(20)) - **UNIQUE**
- `location_name` (varchar(200))
- `location_type` (varchar(50))
- `country` (varchar(100))
- `is_container_seaport` (boolean) - Default: false
- `is_container_inland` (boolean) - Default: false

### **Optional Fields:**
- `alias_1`, `alias_2`, `alias_3` (varchar(200))
- `unlocode` (varchar(5))
- `iata_code` (varchar(3))
- `icao_code` (varchar(4))
- `customs_code` (varchar(20))
- `city`, `state_province`, `region`, `trade_zone` (varchar(100))
- `country_code` (varchar(3))
- `parent_location_id` (uuid) - Foreign key to `locations.id`
- `is_gateway` (boolean) - Default: false
- `serves_locations` (ARRAY)
- `connectivity_modes` (ARRAY)
- `operates_24x7` (boolean) - Default: false
- `has_customs`, `has_container_yard`, `has_warehousing`, `has_rail_terminal` (boolean) - Default: false
- `max_vessel_size` (varchar(50))
- `container_handling_capacity` (integer)
- `reefer_capable`, `hazmat_capable` (boolean) - Default: false
- `address_line1`, `address_line2` (varchar(200))
- `postal_code` (varchar(20))
- `latitude` (numeric(10,8))
- `longitude` (numeric(11,8))
- `timezone` (varchar(50))
- `operating_hours` (varchar(100))
- `contact_email` (varchar(100))
- `contact_phone` (varchar(50))
- `website` (varchar(200))
- `notes` (text)
- `is_active` (boolean) - Default: true
- `is_verified` (boolean) - Default: false
- `data_source` (varchar(100))
- `created_at`, `updated_at` (timestamp with time zone) - Default: now()
- `created_by`, `updated_by` (varchar(100))
- `subdivision` (varchar(32))
- `currency_code` (text)

### **Constraints:**
- **UNIQUE**: `location_code`
- **CHECK**: `NOT (is_container_inland AND is_container_seaport)` (exclusive)
- **Foreign Key**: `parent_location_id` → `locations.id`

### **Indexes:**
- **Primary Key**: `id` (unique)
- **Unique Index**: `location_code`
- **Performance Indexes**:
  - `location_code` (lookup)
  - `is_active` WHERE `is_active = true`
  - `city`, `country`, `location_type`
  - `is_gateway` WHERE `is_gateway = true`
  - `iata_code` WHERE `iata_code IS NOT NULL`
  - `unlocode` WHERE `unlocode IS NOT NULL`
  - `unlocode` WHERE `is_active = true`
  - `is_container_inland` WHERE `is_active = true`
  - `parent_location_id` WHERE `parent_location_id IS NOT NULL`
  - **Full-text search**: GIN index on `location_name + alias_1 + alias_2 + alias_3 + city`

---

## 🎯 **CHARGE MASTER TABLE**

### **Required Fields (NOT NULL):**
- `id` (bigint) - Auto-generated with `nextval('charge_master_id_seq')`
- `leg_type` (USER-DEFINED) - **NOT NULL**
- `charge_code` (text) - **UNIQUE**
- `charge_name` (text)
- `charge_category` (text) - **CHECK constraint**: `['FREIGHT', 'ORIGIN', 'DESTINATION', 'DOCUMENTATION', 'OTHER']`
- `applies_at` (USER-DEFINED) - **NOT NULL**
- `amount_basis` (USER-DEFINED) - **NOT NULL**
- `amount_value` (numeric(12,4))
- `currency` (text)
- `valid_from` (date)
- `valid_to` (date)

### **Optional Fields:**
- `rate_table` (text)
- `rate_row_id` (uuid)
- `description` (text)
- `default_calc_method` (text) - **CHECK constraint**: `['flat', 'percentage', 'tier']`
- `default_uom` (text) - **CHECK constraint**: `['per_cntr', 'per_bl', 'per_shipment', 'per_kg', 'per_cbm']`
- `default_markup_pct` (numeric(5,2)) - Default: 0
- `is_taxable` (boolean) - Default: false
- `tax_rate_pct` (numeric(5,2))
- `origin_scope`, `dest_scope` (boolean) - Default: false
- `is_mandatory` (boolean) - Default: false
- `is_active` (boolean) - Default: true
- `display_order` (integer)
- `pol_id`, `pod_id`, `por_id`, `fpod_id` (uuid) - Foreign keys to `locations`
- `carrier_id` (uuid) - Foreign key to `carriers`
- `country_scope` (text)
- `provider` (text) - Default: 'ANY' - **CHECK constraint**: `['ANY', 'CARRIER', 'FORWARDER']`

### **Constraints:**
- **UNIQUE**: `charge_code`
- **CHECK Constraints**:
  - `charge_category` ∈ `['FREIGHT', 'ORIGIN', 'DESTINATION', 'DOCUMENTATION', 'OTHER']`
  - `default_calc_method` ∈ `['flat', 'percentage', 'tier']`
  - `default_uom` ∈ `['per_cntr', 'per_bl', 'per_shipment', 'per_kg', 'per_cbm']`
  - `provider` ∈ `['ANY', 'CARRIER', 'FORWARDER']`
- **Foreign Keys**:
  - `charge_code` → `ref_charge_code.code`
  - `pol_id`, `pod_id`, `por_id`, `fpod_id` → `locations.id`
  - `carrier_id` → `carriers.id`

### **Indexes:**
- **Primary Key**: `id` (unique)
- **Unique Index**: `charge_code`
- **Performance Indexes**:
  - `charge_code` (lookup)
  - `charge_category`
  - `leg_type + applies_at + valid_from + valid_to` (archive schema)
  - `carrier_id`, `pol_id`, `pod_id`, `por_id`, `fpod_id`
  - `provider`
  - `valid_from + valid_to`
  - **Complex lookup**: `leg_type + applies_at + charge_code + provider + carrier_id + por_id + pol_id + pod_id + fpod_id + valid_from + valid_to`
  - **Date range**: GIST index on `daterange(valid_from, valid_to)`

---

## 🚨 **CRITICAL API DESIGN INSIGHTS**

### **1. Ocean Freight Rate API Issues:**
- ❌ **Wrong field name**: API uses `rate_amount` but DB expects `buy_amount`
- ❌ **Missing required field**: `is_preferred` (boolean, default: false)
- ❌ **Wrong field name**: API uses `transit_days` but DB expects `tt_days`
- ❌ **Location lookup**: API uses `pol_code`/`pod_code` but needs to lookup `locations.id` by `location_code`
- ❌ **Unique constraint**: `contract_id + pol_id + pod_id + container_type` must be unique
- ❌ **Preferred constraint**: Only one `is_preferred = true` per `pol_id + pod_id + container_type`

### **2. Surcharge API Issues:**
- ❌ **Wrong field name**: API uses `rate_amount` but DB expects `amount`
- ❌ **Missing required field**: `vendor_id` (bigint, NOT NULL)
- ❌ **Wrong field name**: API uses `pol_code`/`pod_code` but needs to lookup `locations.id`
- ❌ **Constraint violation**: `charge_code` must exist in `charge_master.charge_code`
- ❌ **Wrong applies_scope**: API uses `'origin'` but indexes expect `'POL'`/`'POD'`

### **3. Location Lookup Strategy:**
- API should accept `pol_code`/`pod_code` (location codes)
- Lookup `locations.id` by `location_code` using the `idx_locations_code` index
- Use the UUID `id` in the actual database insert

### **4. Required Reference Data:**
- `charge_master` table must have entries for `charge_code`
- `ref_container_type` table must have entries for `container_type`
- `ref_currency` table must have entries for `currency`
- `rate_contract` table must have entries for `contract_id`
- `tenants` table must have entries for `tenant_id`

---

## 🔧 **CORRECTED API INPUT FORMATS**

### **Ocean Freight Rate CREATE:**
```json
{
  "contract_id": 4,
  "pol_code": "INNSA",        // Lookup to get pol_id
  "pod_code": "USNYC",        // Lookup to get pod_id
  "container_type": "20GP",   // Must exist in ref_container_type
  "buy_amount": 1500,         // NOT rate_amount
  "currency": "USD",          // Must exist in ref_currency
  "tt_days": 25,              // NOT transit_days
  "is_preferred": false,      // Required field
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31"
}
```

### **Surcharge CREATE:**
```json
{
  "contract_id": 4,
  "charge_code": "THC",       // Must exist in charge_master.charge_code
  "applies_scope": "origin",  // Must be in ['origin', 'port', 'freight', 'dest', 'door', 'other']
  "uom": "per_cntr",         // Must be in ['per_cntr', 'per_bl', 'per_shipment', 'per_kg', 'per_cbm']
  "amount": 200,             // NOT rate_amount
  "currency": "USD",          // Must exist in ref_currency
  "calc_method": "flat",     // Must be in ['flat', 'percentage', 'tier']
  "vendor_id": 4,            // Required field
  "pol_code": "INNSA",       // Lookup to get pol_id
  "valid_from": "2025-01-01",
  "valid_to": "2025-12-31"
}
```

---

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Location Lookup:**
- Use `idx_locations_code` index for fast `location_code` → `id` lookup
- Filter by `is_active = true` using `idx_locations_active`

### **Surcharge Filtering:**
- Use `idx_surcharge_filters` for complex queries
- Use `idx_surcharge_pol`/`idx_surcharge_pod` for scope-specific queries

### **Ocean Freight Rate Queries:**
- Use `idx_ocean_freight_route` for route-based queries
- Use `idx_ocean_freight_preferred` for preferred rate queries
- Use `idx_ocean_freight_valid` for date range queries

### **Charge Master Lookup:**
- Use `idx_charge_master_code` for charge code lookup
- Use complex `ix_cm_lookup` for multi-criteria searches

