# Inland Haulage Management System - Complete Documentation

## 📋 TABLE OF CONTENTS
1. [Overview](#overview)
2. [Database Schema Analysis](#database-schema-analysis)
3. [Table Relationships](#table-relationships)
4. [Business Logic](#business-logic)
5. [Data Flow](#data-flow)
6. [Implementation Strategy](#implementation-strategy)
7. [API Design](#api-design)
8. [UI/UX Design](#uiux-design)

---

## 🎯 OVERVIEW

The Inland Haulage Management System manages the transportation of containers from inland locations (ICDs, factories) to ports and vice versa. It consists of 4 interconnected tables:

### System Components:
1. **Haulage Route** - Master route definitions (e.g., Delhi ICD to Mumbai Port)
2. **Haulage Rate** - Pricing for routes by vendor/contract
3. **Haulage Leg** - Multi-modal route segments (e.g., Rail + Road)
4. **Haulage Responsibility** - Terms defining who arranges/pays for haulage (IHE/IHI)

### Real-World Use Case:
```
Customer needs to ship container from Sonipat (inland) to Rotterdam (Europe):
├── IHE (Inland Haulage Export): Sonipat → Mundra Port
│   ├── Route: HR-INSON-INMUN-RD
│   ├── Mode: ROAD or RAIL
│   ├── Rate: ₹18,000 per 40HC (Vendor XYZ)
│   └── Responsibility: Who arranges/pays? (FOB, FCA, Carrier Haulage, etc.)
├── Ocean Freight: Mundra → Rotterdam (handled by Ocean Freight system)
└── IHI (Inland Haulage Import): Rotterdam Port → Final destination (handled by consignee)
```

---

## 📊 DATABASE SCHEMA ANALYSIS

### 1. HAULAGE_ROUTE (Master Table)

**Purpose**: Defines available inland transportation routes

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | bigint | NO | Auto-increment PK |
| `route_code` | text | NO | Unique route identifier (e.g., "HR-INSON-INMUN-RD") |
| `route_name` | text | YES | Human-readable name |
| `from_location_id` | uuid | NO | FK to `locations` table |
| `to_location_id` | uuid | NO | FK to `locations` table |
| `total_distance_km` | numeric | YES | Total route distance |
| `avg_transit_days` | integer | YES | Average transit time |
| `service_frequency` | text | YES | "Daily", "Weekly", "Twice a Week" |
| `available_modes` | text[] | YES | Array: ["ROAD", "RAIL", "BARGE"] |
| `primary_mode` | text | YES | Default: "ROAD" |
| `is_active` | boolean | YES | Default: true |
| `notes` | text | YES | Additional information |
| `tenant_id` | uuid | NO | Multi-tenancy |
| `created_at` | timestamp | YES | Auto |
| `updated_at` | timestamp | YES | Auto |

**Constraints**:
- ✅ `chk_different_locations`: from_location_id ≠ to_location_id
- ✅ Unique `route_code`
- ✅ FK to `locations` (from/to)
- ✅ FK to `tenants` (CASCADE DELETE)

**Sample Data**:
```
route_code: "HR-INSON-INMUN-RD"
route_name: "Sonepat to Mundra (Road)"
from: Sonipat (INSON)
to: Mundra (INMUN)
distance: 1250 km
transit: 3 days
frequency: Weekly
modes: [ROAD]
```

**Business Rules**:
- Route code format: `HR-{FROM_LOCODE}-{TO_LOCODE}-{MODE}`
- Same origin/destination can have multiple routes (different modes)
- Example: Sonipat→Mundra can be ROAD or RAIL

---

### 2. HAULAGE_RATE (Pricing Table)

**Purpose**: Vendor pricing for routes (the most complex table!)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | bigint | NO | Auto-increment PK |
| `vendor_id` | bigint | NO | FK to `vendor` |
| `contract_id` | bigint | YES | FK to `rate_contract` (optional) |
| `charge_code` | text | NO | FK to `charge_master` (e.g., "IHE", "IHI") |
| `route_id` | bigint | NO | FK to `haulage_route` |
| `leg_id` | bigint | YES | FK to `haulage_leg` (if rate is leg-specific) |
| `transport_mode` | text | NO | "ROAD", "RAIL", "BARGE" |
| `rate_basis` | text | NO | **KEY FIELD** - see below |
| `container_type` | text | YES | FK to `ref_container_type` |
| `rate_per_container` | numeric | YES | If rate_basis = PER_CONTAINER |
| `min_weight_kg` | numeric | YES | If rate_basis = WEIGHT_SLAB |
| `max_weight_kg` | numeric | YES | If rate_basis = WEIGHT_SLAB |
| `rate_per_unit` | numeric | YES | Per KG, TON, CBM |
| `flat_rate` | numeric | YES | If rate_basis = FLAT |
| `currency` | text | NO | FK to `ref_currency` |
| `fuel_surcharge_pct` | numeric | YES | % added to base rate |
| `toll_charges` | numeric | YES | Additional toll fees |
| `loading_charges` | numeric | YES | Origin loading |
| `unloading_charges` | numeric | YES | Destination unloading |
| `documentation_fee` | numeric | YES | Paperwork charges |
| `free_days` | integer | YES | Default: 3 days |
| `detention_per_day` | numeric | YES | Charge after free days |
| `minimum_charge` | numeric | YES | Floor pricing |
| `valid_from` | date | NO | Rate validity start |
| `valid_to` | date | NO | Rate validity end |
| `is_active` | boolean | YES | Default: true |
| `notes` | text | YES | |
| `tenant_id` | uuid | NO | Multi-tenancy |
| `created_at` | timestamp | YES | Auto |
| `updated_at` | timestamp | YES | Auto |

**Rate Basis Options** (with constraints):
1. **PER_CONTAINER**: Rate per container type
   - Required: `container_type`, `rate_per_container`
   - Example: ₹18,000 per 40HC container

2. **WEIGHT_SLAB**: Tiered pricing by weight
   - Required: `min_weight_kg`, `max_weight_kg`, `rate_per_unit`
   - Example: 0-10,000 kg = ₹50/kg, 10,001-20,000 kg = ₹45/kg

3. **PER_KG / PER_TON / PER_CBM**: Unit-based pricing
   - Required: `rate_per_unit`
   - Example: ₹30 per kg

4. **FLAT**: Fixed rate regardless of weight/volume
   - Required: `flat_rate`
   - Example: ₹25,000 flat (any container)

**Constraints**:
- ✅ `chk_container_rate`: If rate_basis = PER_CONTAINER, then container_type and rate_per_container must be set
- ✅ `chk_weight_slab`: If rate_basis = WEIGHT_SLAB, then min/max weight and rate_per_unit must be set
- ✅ `chk_flat_rate`: If rate_basis = FLAT, then flat_rate must be set
- ✅ `chk_valid_dates`: valid_to >= valid_from
- ✅ FK to vendor, contract, route, leg, charge_master, currency, container_type

**Sample Data**:
```json
{
  "vendor_id": 12,
  "charge_code": "IHE",
  "route_id": 2,
  "transport_mode": "ROAD",
  "rate_basis": "PER_CONTAINER",
  "container_type": "40HC",
  "rate_per_container": 19000,
  "currency": "INR",
  "fuel_surcharge_pct": 4,
  "free_days": 3,
  "detention_per_day": 1000,
  "valid_from": "2024-01-01",
  "valid_to": "2024-12-31"
}
```

**Business Logic**:
- Rate can be for entire route OR specific leg
- Multiple vendors can quote for same route
- Same vendor can have different rates for different container types
- Additional charges (fuel, toll, loading) are added on top of base rate

**Total Rate Calculation**:
```javascript
base_rate = rate_per_container (or calculated from weight/unit)
fuel_charge = base_rate * (fuel_surcharge_pct / 100)
total = base_rate + fuel_charge + toll_charges + loading_charges + unloading_charges + documentation_fee

if (total < minimum_charge) {
  total = minimum_charge
}

// Detention (if container detained beyond free_days)
if (days_held > free_days) {
  detention = (days_held - free_days) * detention_per_day
  total += detention
}
```

---

### 3. HAULAGE_LEG (Multi-Modal Routing)

**Purpose**: Break complex routes into segments (e.g., Rail + Road)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | bigint | NO | Auto-increment PK |
| `route_id` | bigint | NO | FK to `haulage_route` (CASCADE DELETE) |
| `leg_sequence` | integer | NO | Order (1, 2, 3...) |
| `leg_name` | text | YES | Human-readable |
| `from_location_id` | uuid | NO | FK to `locations` |
| `to_location_id` | uuid | NO | FK to `locations` |
| `transport_mode` | text | NO | "ROAD", "RAIL", "BARGE" |
| `distance_km` | numeric | YES | Leg distance |
| `transit_days` | integer | YES | Leg transit time |
| `via_point_id` | uuid | YES | FK to `locations` (optional waypoint) |
| `notes` | text | YES | |
| `tenant_id` | uuid | NO | Multi-tenancy |
| `created_at` | timestamp | YES | Auto |
| `updated_at` | timestamp | YES | Auto |

**Constraints**:
- ✅ `chk_leg_different_locations`: from_location_id ≠ to_location_id
- ✅ `unique_route_leg`: (route_id, leg_sequence) is unique
- ✅ FK to `haulage_route` (CASCADE DELETE) - if route deleted, legs deleted
- ✅ FK to `locations` (from/to/via)

**Sample Data** (Multi-modal route):
```
Route: Tughlakabad ICD → Nhava Sheva Port (RAIL + ROAD)

Leg 1:
  sequence: 1
  name: "Tughlakabad to Patparganj Junction (Rail)"
  from: Tughlakabad ICD
  to: Patparganj Junction
  mode: RAIL
  distance: 1400 km
  transit: 2 days

Leg 2:
  sequence: 2
  name: "Patparganj to Nhava Sheva Port (Road)"
  from: Patparganj Junction
  to: Nhava Sheva Port
  mode: ROAD
  distance: 50 km
  transit: 1 day
```

**Business Rules**:
- Legs must be in sequence (1, 2, 3...)
- Last leg's `to_location` should match route's `to_location`
- First leg's `from_location` should match route's `from_location`
- Mode can change between legs (intermodal transport)
- Rates can be applied to entire route OR individual legs

**Use Cases**:
1. **Simple Route**: Single leg (direct road/rail)
2. **Intermodal Route**: Rail to port + road drayage to CFS
3. **Complex Route**: Multiple transshipment points

---

### 4. HAULAGE_RESPONSIBILITY (IHE/IHI Terms)

**Purpose**: Define who arranges and pays for inland haulage (master data, not tenant-specific!)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | bigint | NO | Auto-increment PK |
| `term_code` | text | NO | Unique (e.g., "FOB", "CARRIER_HAULAGE") |
| `term_name` | text | NO | Display name |
| `term_category` | text | YES | "INCOTERM", "CUSTOM", "STANDARD" |
| `description` | text | YES | Explanation |
| `ihe_arranged_by` | text | NO | "CARRIER", "MERCHANT", "FORWARDER" |
| `ihe_paid_by` | text | NO | "CARRIER", "MERCHANT", "FORWARDER", "CONSIGNEE" |
| `ihe_include_in_quote` | boolean | YES | Default: true |
| `ihi_arranged_by` | text | NO | "CARRIER", "MERCHANT", "FORWARDER" |
| `ihi_paid_by` | text | NO | "CARRIER", "MERCHANT", "FORWARDER", "CONSIGNEE" |
| `ihi_include_in_quote` | boolean | YES | Default: true |
| `common_usage` | text | YES | When to use this term |
| `notes` | text | YES | |
| `is_active` | boolean | YES | Default: true |
| `created_at` | timestamp | YES | Auto |
| `updated_at` | timestamp | YES | Auto |

**⚠️ IMPORTANT**: This table has NO `tenant_id` - it's **global reference data**!

**Key Terms**:

1. **IHE (Inland Haulage Export)**: Origin → Port
2. **IHI (Inland Haulage Import)**: Port → Destination

**Constraints**:
- ✅ Unique `term_code`
- ✅ CHECK: ihe_arranged_by IN ('CARRIER', 'MERCHANT', 'FORWARDER')
- ✅ CHECK: ihe_paid_by IN ('CARRIER', 'MERCHANT', 'FORWARDER', 'CONSIGNEE')
- ✅ CHECK: ihi_arranged_by IN ('CARRIER', 'MERCHANT', 'FORWARDER')
- ✅ CHECK: ihi_paid_by IN ('CARRIER', 'MERCHANT', 'FORWARDER', 'CONSIGNEE')
- ✅ CHECK: term_category IN ('INCOTERM', 'CUSTOM', 'STANDARD')

**Sample Data**:

| Term Code | IHE Arranged By | IHE Paid By | IHE in Quote? | IHI Arranged By | IHI Paid By | IHI in Quote? |
|-----------|-----------------|-------------|---------------|-----------------|-------------|---------------|
| **CARRIER_HAULAGE** | CARRIER | CARRIER | ✅ Yes | CARRIER | CARRIER | ✅ Yes |
| **MERCHANT_HAULAGE** | MERCHANT | MERCHANT | ❌ No | MERCHANT | MERCHANT | ❌ No |
| **FORWARDER_HAULAGE** | FORWARDER | FORWARDER | ✅ Yes | FORWARDER | FORWARDER | ✅ Yes |
| **FOB** | MERCHANT | MERCHANT | ❌ No | MERCHANT | MERCHANT | ❌ No |
| **FCA** | MERCHANT | MERCHANT | ❌ No | MERCHANT | MERCHANT | ❌ No |

**Business Logic**:
- If `ihe_include_in_quote = true`: Include IHE rate in quote
- If `ihe_include_in_quote = false`: Customer arranges own haulage (not quoted)

**Use Cases**:
- **Carrier Haulage (CY/CY)**: Carrier handles door-to-door, IHE+IHI included in quote
- **Merchant Haulage (Port/Port)**: Customer handles own inland transport, only ocean freight quoted
- **FOB (Free on Board)**: Seller delivers to origin port, buyer handles from destination port

---

## 🔗 TABLE RELATIONSHIPS

### Entity Relationship Diagram (ERD):

```
┌─────────────────┐
│   HAULAGE_ROUTE │ (Master)
│   - route_code  │
│   - from/to loc │
│   - modes []    │
└────────┬────────┘
         │
         │ 1:N
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
┌────────────────┐              ┌─────────────────┐
│  HAULAGE_LEG   │              │  HAULAGE_RATE   │
│  - leg_seq     │              │  - vendor_id    │
│  - from/to loc │              │  - contract_id  │
│  - mode        │              │  - rate_basis   │
└────────┬───────┘              │  - pricing      │
         │                      └────────┬────────┘
         │                               │
         │ N:1                           │ N:1
         └───────────────────────────────┘
                  (leg_id - optional FK)

┌─────────────────────────┐
│ HAULAGE_RESPONSIBILITY  │ (Global Reference Data)
│ - term_code             │
│ - IHE arrange/pay       │
│ - IHI arrange/pay       │
│ - include in quote?     │
└─────────────────────────┘
```

### Key Relationships:

1. **Route → Legs** (1:N, CASCADE DELETE)
   - One route can have multiple legs (intermodal)
   - If route deleted, all legs deleted
   - Example: Delhi→Mumbai route has 2 legs (Rail + Road)

2. **Route → Rates** (1:N)
   - One route can have multiple rates (different vendors, container types)
   - Example: Sonipat→Mundra has rates from Vendor A, B, C

3. **Leg → Rates** (1:N, optional)
   - Rate can be for entire route (leg_id = NULL)
   - OR rate can be leg-specific (leg_id = 123)
   - Example: Rail leg priced separately from road leg

4. **Vendor → Rates** (1:N)
   - One vendor can quote multiple rates
   - Example: Vendor ABC has rates for 10 different routes

5. **Contract → Rates** (1:N, optional)
   - Rates can be under a contract OR ad-hoc (contract_id = NULL)
   - Example: Annual contract with guaranteed rates

6. **Locations → Routes/Legs** (N:N)
   - One location can be origin/destination for many routes
   - Example: Mumbai Port is destination for 50+ routes

7. **Charge Master → Rates** (1:N)
   - Rates must use valid charge codes (IHE, IHI, etc.)
   - FK constraint ensures data integrity

### Data Counts (Production):
- Routes: **15**
- Rates: **30**
- Legs: **2** (mostly simple routes, few intermodal)
- Responsibilities: **10** (reference data)

---

## 💼 BUSINESS LOGIC

### Scenario 1: Simple Single-Mode Haulage

**Customer Request**: Ship 40HC container from Sonipat to Mundra Port

**System Process**:
1. Find active route: Sonipat (INSON) → Mundra (INMUN)
2. Find available modes: [ROAD, RAIL]
3. Get rates for each mode:
   - Road: ₹18,000 (3 days)
   - Rail: ₹16,000 (2 days)
4. Check haulage responsibility term (e.g., FOB):
   - IHE arranged by: MERCHANT
   - IHE include in quote: NO
5. Result: Customer arranges own haulage (not quoted)

### Scenario 2: Multi-Modal with Leg-Specific Pricing

**Customer Request**: Container from Tughlakabad ICD to Nhava Sheva Port

**Route Structure**:
```
Leg 1: Tughlakabad → Patparganj (RAIL) - 1400 km - 2 days
Leg 2: Patparganj → Nhava Sheva (ROAD) - 50 km - 1 day
```

**Pricing Options**:
- **Option A**: Single rate for entire route (leg_id = NULL)
  - Rate: ₹50,000 flat for complete journey
  
- **Option B**: Separate rates per leg
  - Leg 1 Rate: ₹45,000 (rail)
  - Leg 2 Rate: ₹8,000 (drayage)
  - Total: ₹53,000

### Scenario 3: Weight Slab Pricing

**Customer Request**: Ship 25,000 kg cargo from Delhi to Mumbai

**Rate Structure**:
```
Vendor: XYZ Logistics
Route: Delhi ICD → Mumbai Port
Rate Basis: WEIGHT_SLAB

Slabs:
├── 0 - 10,000 kg: ₹50/kg (₹500,000 max)
├── 10,001 - 20,000 kg: ₹45/kg (₹450,000 for next 10,000 kg)
└── 20,001 - 30,000 kg: ₹40/kg (₹200,000 for remaining 5,000 kg)

Total: ₹1,150,000
```

### Scenario 4: Additional Charges Calculation

**Base Rate**: ₹18,000 per 40HC
**Add-ons**:
- Fuel surcharge: 4% = ₹720
- Toll charges: ₹500
- Loading charges: ₹1,000
- Documentation fee: ₹300

**Subtotal**: ₹20,520

**Detention** (if applicable):
- Free days: 3
- Container held: 7 days
- Detention per day: ₹1,000
- Detention charge: (7 - 3) × ₹1,000 = ₹4,000

**Final Total**: ₹24,520

---

## 🔄 DATA FLOW

### Quote Preparation Workflow:

```
1. Customer Request
   ↓
2. Check Haulage Responsibility Term
   ├─→ If IHE/IHI NOT included in quote → Skip haulage pricing
   └─→ If IHE/IHI included in quote → Continue
       ↓
3. Find Matching Routes
   ├─→ From origin location
   ├─→ To port (for IHE) or destination (for IHI)
   └─→ Active routes only
       ↓
4. Get Rates for Routes
   ├─→ Filter by: vendor, contract, container_type, valid dates
   ├─→ Check rate_basis constraints
   └─→ Calculate total cost (base + surcharges)
       ↓
5. Sort & Present Options
   ├─→ By: Price (low to high), Transit time, Vendor
   └─→ Show: Route, Mode, Rate breakdown, Transit days
       ↓
6. Customer Selects Option
   ↓
7. Include in Final Quote
   └─→ IHE + Ocean Freight + IHI = Total Quote
```

### Rate Search Logic:

```sql
-- Pseudo-query for finding applicable rates
SELECT 
  hr.route_code,
  hr.route_name,
  hrate.vendor_id,
  hrate.transport_mode,
  hrate.rate_per_container,
  hrate.currency,
  hrate.fuel_surcharge_pct,
  hrate.valid_from,
  hrate.valid_to
FROM haulage_route hr
INNER JOIN haulage_rate hrate ON hr.id = hrate.route_id
WHERE hr.from_location_id = :origin_location_id
  AND hr.to_location_id = :destination_location_id
  AND hr.is_active = true
  AND hrate.is_active = true
  AND hrate.container_type = :container_type
  AND :shipment_date BETWEEN hrate.valid_from AND hrate.valid_to
  AND hrate.rate_basis = 'PER_CONTAINER'
ORDER BY hrate.rate_per_container ASC;
```

---

## 🏗️ IMPLEMENTATION STRATEGY

### Phase 1: Backend APIs (Priority: HIGH)

**Create 4 API endpoint groups** in `src/index.ts`:

1. **Haulage Routes** (7 endpoints)
   - `GET /api/haulage-routes` - List with filters
   - `POST /api/haulage-routes` - Create
   - `PUT /api/haulage-routes/:id` - Update
   - `DELETE /api/haulage-routes/:id` - Delete
   - `GET /api/haulage-routes/:id` - Get single
   - `GET /api/haulage-routes/:id/legs` - Get legs for route
   - `GET /api/haulage-routes/:id/rates` - Get rates for route

2. **Haulage Rates** (5 endpoints)
   - `GET /api/haulage-rates` - List with filters
   - `POST /api/haulage-rates` - Create
   - `PUT /api/haulage-rates/:id` - Update
   - `DELETE /api/haulage-rates/:id` - Delete
   - `GET /api/haulage-rates/:id` - Get single

3. **Haulage Legs** (5 endpoints)
   - `GET /api/haulage-legs` - List with filters
   - `POST /api/haulage-legs` - Create
   - `PUT /api/haulage-legs/:id` - Update
   - `DELETE /api/haulage-legs/:id` - Delete
   - `GET /api/haulage-legs/:id` - Get single

4. **Haulage Responsibilities** (4 endpoints - READ MOSTLY)
   - `GET /api/haulage-responsibilities` - List all
   - `POST /api/haulage-responsibilities` - Create (admin only)
   - `PUT /api/haulage-responsibilities/:id` - Update (admin only)
   - `GET /api/haulage-responsibilities/:id` - Get single

**Total**: 21 API endpoints

### Phase 2: Apex Services (Priority: HIGH)

Create 4 Apex classes:
1. `RMSHaulageRouteService.cls`
2. `RMSHaulageRateService.cls`
3. `RMSHaulageLegService.cls`
4. `RMSHaulageResponsibilityService.cls`

### Phase 3: Schema Constants (Priority: HIGH)

Add to `rmsSchemaConstants.js`:
- `HAULAGE_ROUTE_FIELDS`
- `HAULAGE_RATE_FIELDS`
- `HAULAGE_LEG_FIELDS`
- `HAULAGE_RESPONSIBILITY_FIELDS`
- `RATE_BASIS_OPTIONS`
- `TRANSPORT_MODE_OPTIONS`

### Phase 4: LWC Components (Priority: MEDIUM)

**Recommended UI Structure: Master-Detail View**

```
┌─────────────────────────────────────────────────────────┐
│ RMS Management                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Haulage] Tab                                       │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │                                                     │ │
│ │ ┌─ Haulage Routes (Card View) ─────────────────┐  │ │
│ │ │ 🚚 Sonipat → Mundra (Road)    [View] [Edit]  │  │ │
│ │ │ 🚂 Sonipat → Mundra (Rail)    [View] [Edit]  │  │ │
│ │ │ 🚚 Tughlakabad → Nhava Sheva  [View] [Edit]  │  │ │
│ │ └──────────────────────────────────────────────┘  │ │
│ │                                                     │ │
│ │ ┌─ Details for Selected Route ─────────────────┐  │ │
│ │ │ [Rates] [Legs] [Info]                        │  │ │
│ │ │                                               │  │ │
│ │ │ Rate Table:                                   │  │ │
│ │ │ Vendor | Container | Rate | Mode | Actions   │  │ │
│ │ │ ABC Co | 40HC     | 18K  | ROAD | [Edit][Del]│ │ │
│ │ │ XYZ Ltd| 40GP     | 15K  | ROAD | [Edit][Del]│ │ │
│ │ └──────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Alternative: Separate Tabs**
- Sub-tab 1: Routes
- Sub-tab 2: Rates  
- Sub-tab 3: Legs
- Sub-tab 4: Responsibilities (Reference Data)

### Phase 5: Audit Logging (Priority: HIGH)

Add `logAudit()` calls to all CRUD operations for:
- ✅ haulage_route
- ✅ haulage_rate
- ✅ haulage_leg
- ✅ haulage_responsibility

---

## 🎨 UI/UX DESIGN

### Routes Display (Card-Based):

```
┌────────────────────────────────────────────┐
│ 🚚 Sonipat → Mundra (Road)                │
│                                            │
│ Code: HR-INSON-INMUN-RD                   │
│ Distance: 1250 km │ Transit: 3 days       │
│ Modes: ROAD │ Frequency: Weekly           │
│                                            │
│ [View Rates] [View Legs] [Edit] [Delete]  │
└────────────────────────────────────────────┘
```

### Rates Display (Table-Based):

| Vendor | Contract | Container | Base Rate | Fuel % | Total | Mode | Valid From | Valid To | Actions |
|--------|----------|-----------|-----------|--------|-------|------|------------|----------|---------|
| ABC Co | CNT-001 | 40HC | ₹18,000 | 4% | ₹18,720 | ROAD | 2024-01-01 | 2024-12-31 | 🔍 ✏️ 🗑️ |
| XYZ Ltd | - | 40GP | ₹15,000 | 5% | ₹15,750 | RAIL | 2024-06-01 | 2024-12-31 | 🔍 ✏️ 🗑️ |

### Legs Display (Sequenced Table):

| Seq | Leg Name | From | To | Mode | Distance | Transit | Actions |
|-----|----------|------|-----|------|----------|---------|---------|
| 1 | Tughlakabad to Patparganj (Rail) | INTKD | INPPJ | RAIL | 1400 km | 2 days | ✏️ 🗑️ |
| 2 | Patparganj to Nhava Sheva (Road) | INPPJ | INNSA | ROAD | 50 km | 1 day | ✏️ 🗑️ |

### Responsibilities Display (Table):

| Term Code | Term Name | IHE By | IHI By | Include IHE? | Include IHI? | Category |
|-----------|-----------|--------|--------|--------------|--------------|----------|
| CARRIER_HAULAGE | Carrier Haulage (CY/CY) | CARRIER | CARRIER | ✅ Yes | ✅ Yes | STANDARD |
| MERCHANT_HAULAGE | Merchant Haulage (Port/Port) | MERCHANT | MERCHANT | ❌ No | ❌ No | STANDARD |
| FOB | FOB - Free on Board | MERCHANT | MERCHANT | ❌ No | ❌ No | INCOTERM |

---

## 📝 IMPLEMENTATION CHECKLIST

### Backend (API + Database):
- [ ] Create 21 API endpoints across 4 groups
- [ ] Add validation for rate_basis constraints
- [ ] Implement JOIN queries (route → legs, route → rates)
- [ ] Add audit logging to all CRUD operations
- [ ] Test each endpoint with Postman/curl
- [ ] Document API in API_DOCUMENTATION_V4.md

### Frontend (Salesforce LWC):
- [ ] Create 4 schema constant objects
- [ ] Build master-detail LWC component (or separate tabs)
- [ ] Implement location lookup fields
- [ ] Add vendor/contract dependent dropdowns
- [ ] Create rate_basis conditional fields
- [ ] Add leg sequencing UI
- [ ] Style with SLDS theme colors
- [ ] Deploy to Salesforce org

### Apex (Salesforce Backend):
- [ ] Create 4 Apex service classes
- [ ] Add @AuraEnabled methods for CRUD
- [ ] Handle error cases gracefully
- [ ] Deploy classes to Salesforce

### Testing:
- [ ] Create test routes (simple + multi-modal)
- [ ] Add rates with different rate_basis types
- [ ] Test leg sequencing and cascade delete
- [ ] Verify responsibility terms work correctly
- [ ] Check audit log entries
- [ ] Test filters and search

### Documentation:
- [ ] API endpoint documentation
- [ ] User guide for haulage management
- [ ] CSV templates for bulk upload
- [ ] Business logic documentation

---

## 🎯 SUCCESS CRITERIA

✅ All 4 tables have complete CRUD operations  
✅ Master-detail relationship working (Route → Rates, Route → Legs)  
✅ Rate calculation logic implemented correctly  
✅ Multi-modal routing (legs) working  
✅ Haulage responsibility terms integrated  
✅ Audit logging active for all operations  
✅ UI is intuitive and follows SLDS design  
✅ All data validated before insert  
✅ Location lookups working  
✅ Vendor/contract dropdowns cascading correctly  

---

## 🚀 NEXT STEPS

**Morning Tasks (Start with this!)**:
1. ✅ Review this documentation thoroughly
2. ⏳ Create API endpoints for haulage_route (7 endpoints)
3. ⏳ Create API endpoints for haulage_rate (5 endpoints)
4. ⏳ Test APIs with sample data

**Afternoon Tasks**:
1. ⏳ Create API endpoints for haulage_leg (5 endpoints)
2. ⏳ Create API endpoints for haulage_responsibility (4 endpoints)
3. ⏳ Add schema constants to LWC
4. ⏳ Build Apex services

**Evening Tasks**:
1. ⏳ Build LWC master-detail component
2. ⏳ Deploy and test
3. ⏳ Add audit logging
4. ⏳ Update documentation

---

**Ready to build! Let's start with the backend APIs!** 🚀💪


