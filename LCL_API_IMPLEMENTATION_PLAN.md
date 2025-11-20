# LCL API Implementation Plan
**Date**: 2025-11-21
**Status**: Ready to Start

---

## 📋 Today's Accomplishments (2025-11-20)

✅ **Database Schema Complete**
- `lcl_ocean_freight_rate` table (FLAT_RATE + SLAB_BASED pricing)
- `lcl_surcharge` table (flexible rate basis)
- `lcl_shipment_item` table (auto-calculated chargeable weight)
- All indexes, RLS policies, and constraints in place

✅ **Pricing Function Tested**
- `calculate_lcl_freight_cost()` working correctly
- Chargeable weight logic: MAX(actual, volumetric)
- Minimum charge enforcement
- Detailed breakdown returned

✅ **Sample Data Loaded**
- 12 ocean freight rates (4 vendors, 2 pricing models)
- 5 surcharges (flat + percentage-based)
- Ready for API testing

---

## 🎯 Tomorrow's Goals (2025-11-21)

### Phase 1: LCL CRUD APIs (3-4 hours)

#### 1.1 LCL Ocean Freight Rate CRUD
**Endpoints:**
```
GET    /api/lcl-rates                    # List with filters (origin, dest, vendor, pricing_model, service_type)
GET    /api/lcl-rates/:id                # Get single rate with vendor details
POST   /api/lcl-rates                    # Create rate (with validation)
PUT    /api/lcl-rates/:id                # Update rate
DELETE /api/lcl-rates/:id                # Delete rate
POST   /api/lcl-rates/bulk               # Bulk create (for CSV upload)
```

**Key Features:**
- Filter by: `origin_code`, `destination_code`, `vendor_id`, `pricing_model`, `service_type`
- JOIN with `vendor` table for vendor name/logo
- Validate: `min_volume_cbm <= max_volume_cbm`
- Validate: `valid_from <= valid_to`
- Validate: Rate basis matches (PER_CBM → rate_per_cbm NOT NULL)
- Audit logging for all CUD operations

#### 1.2 LCL Surcharge CRUD
**Endpoints:**
```
GET    /api/lcl-surcharges               # List with filters
GET    /api/lcl-surcharges/:id           # Get single
POST   /api/lcl-surcharges               # Create
PUT    /api/lcl-surcharges/:id           # Update
DELETE /api/lcl-surcharges/:id           # Delete
POST   /api/lcl-surcharges/bulk          # Bulk create
```

**Key Features:**
- Filter by: `vendor_id`, `charge_code`, `applies_scope`, `origin_code`, `destination_code`
- Validate: `charge_code` exists in `charge_master`
- Validate: PERCENTAGE rate basis → `percentage` between 0-100
- Audit logging

#### 1.3 LCL Shipment Item CRUD
**Endpoints:**
```
GET    /api/lcl-items                    # List by enquiry_id
GET    /api/lcl-items/:id                # Get single item
POST   /api/lcl-items                    # Create item (auto-calc weight/volume)
PUT    /api/lcl-items/:id                # Update item
DELETE /api/lcl-items/:id                # Delete item
POST   /api/lcl-items/bulk               # Bulk create (for multi-item quotes)
```

**Key Features:**
- Auto-calculated fields: `volume_cbm`, `volumetric_weight_kg`, `chargeable_weight_kg`
- Filter by: `enquiry_id`, `is_hazardous`, `is_temperature_controlled`
- Aggregate totals: `SUM(total_volume_cbm)`, `SUM(total_chargeable_weight_kg)`

---

### Phase 2: LCL Search Rates API (2-3 hours)

#### 2.1 Endpoint Design
```
POST /api/v4/search-lcl-rates
```

**Request Body:**
```json
{
  "origin_code": "INNSA",
  "destination_code": "NLRTM",
  "items": [
    {
      "length_cm": 100,
      "width_cm": 80,
      "height_cm": 60,
      "gross_weight_kg": 200,
      "pieces": 5,
      "commodity": "Electronics"
    }
  ],
  "service_type": "CONSOLIDATED",  // optional: DIRECT, CONSOLIDATED
  "vendor_ids": [1, 2],             // optional: filter by vendors
  "valid_date": "2025-11-21"       // optional: defaults to today
}
```

**Response:**
```json
{
  "success": true,
  "total_volume_cbm": 2.4,
  "total_weight_kg": 1000,
  "total_chargeable_weight_kg": 2400,
  "rates": [
    {
      "rate_id": 13,
      "vendor_id": 1,
      "vendor_name": "Maersk Line",
      "vendor_logo": "carrier_maersk",
      "origin": "INNSA",
      "destination": "NLRTM",
      "service_type": "CONSOLIDATED",
      "pricing_model": "SLAB_BASED",
      "matched_slab": {
        "min_volume_cbm": 0,
        "max_volume_cbm": 3,
        "rate_per_cbm": 60.00,
        "max_weight_per_slab_kg": 3000
      },
      "freight_cost": 144.00,
      "minimum_charge": 80.00,
      "minimum_charge_applied": false,
      "surcharges": [
        {
          "charge_code": "THC_ORIGIN",
          "charge_name": "Terminal Handling Charge (Origin)",
          "amount": 36.00,
          "calculation": "2.4 CBM × $15/CBM"
        },
        {
          "charge_code": "BAF",
          "charge_name": "Bunker Adjustment Factor",
          "amount": 14.40,
          "calculation": "10% of $144"
        }
      ],
      "total_cost": 194.40,
      "currency": "USD",
      "transit_days": 28,
      "valid_from": "2025-01-01",
      "valid_to": "2025-12-31"
    }
  ]
}
```

#### 2.2 Logic Steps
1. **Calculate Total Volume & Weight:**
   - `total_volume_cbm = SUM(items.volume_cbm × pieces)`
   - `total_chargeable_weight_kg = SUM(MAX(gross_weight, volumetric_weight) × pieces)`

2. **Find Matching Rates:**
   - Filter by: `origin_code`, `destination_code`, `is_active`, date range
   - Optional: `service_type`, `vendor_ids`
   - For SLAB_BASED: match volume to correct slab (`min_volume <= total <= max_volume`)
   - For FLAT_RATE: single rate applies

3. **Calculate Freight Cost:**
   - Use `calculate_lcl_freight_cost()` function OR inline calculation
   - Apply minimum charge if applicable

4. **Apply Surcharges:**
   - Fetch matching surcharges by `origin_code`, `destination_code`, `vendor_id`
   - Calculate based on `rate_basis`:
     - `PER_CBM`: `amount × total_volume_cbm`
     - `PER_SHIPMENT`: `amount`
     - `PERCENTAGE`: `freight_cost × (percentage / 100)`

5. **Sort & Return:**
   - Sort by `total_cost` ASC
   - Include breakdown for transparency

---

### Phase 3: LCL Prepare Quote API (2-3 hours)

#### 3.1 Endpoint Design
```
POST /api/v4/prepare-lcl-quote
```

**Request Body:**
```json
{
  "enquiry_id": "ENQ-LCL-2025-001",
  "customer_id": "CUST-123",
  "rate_id": 13,
  "items": [
    {
      "length_cm": 100,
      "width_cm": 80,
      "height_cm": 60,
      "gross_weight_kg": 200,
      "pieces": 5,
      "commodity": "Electronics",
      "packaging_type": "Carton"
    }
  ],
  "additional_surcharges": [
    {
      "charge_code": "INSURANCE",
      "amount": 50.00
    }
  ],
  "margin_rule_id": 5,  // optional: apply margin
  "notes": "Urgent shipment"
}
```

**Response:**
```json
{
  "success": true,
  "quote_id": "QTE-LCL-2025-001",
  "enquiry_id": "ENQ-LCL-2025-001",
  "created_at": "2025-11-21T10:30:00Z",
  
  "shipment_summary": {
    "total_pieces": 5,
    "total_volume_cbm": 2.4,
    "total_weight_kg": 1000,
    "total_chargeable_weight_kg": 2400,
    "items": [...]
  },
  
  "rate_details": {
    "vendor_name": "Maersk Line",
    "service_type": "CONSOLIDATED",
    "pricing_model": "SLAB_BASED",
    "origin": "INNSA",
    "destination": "NLRTM",
    "transit_days": 28
  },
  
  "cost_breakdown": {
    "freight": {
      "buy_amount": 144.00,
      "calculation": "2.4 CBM × $60/CBM"
    },
    "surcharges": [
      {
        "charge_code": "THC_ORIGIN",
        "buy_amount": 36.00
      },
      {
        "charge_code": "BAF",
        "buy_amount": 14.40
      },
      {
        "charge_code": "INSURANCE",
        "buy_amount": 50.00
      }
    ],
    "total_buy": 244.40
  },
  
  "margin": {
    "rule_name": "Standard LCL Margin",
    "percentage": 15,
    "amount": 36.66
  },
  
  "sell_price": {
    "total": 281.06,
    "currency": "USD",
    "valid_until": "2025-12-31"
  }
}
```

#### 3.2 Logic Steps
1. **Validate Rate Availability:**
   - Check `lcl_ocean_freight_rate` exists and is active
   - Verify volume falls within slab range (if SLAB_BASED)

2. **Create Shipment Items:**
   - Insert into `lcl_shipment_item` table
   - Auto-calculate volumes and weights

3. **Calculate Freight Cost:**
   - Use `calculate_lcl_freight_cost()` function
   - Get buy amount from rate

4. **Apply Surcharges:**
   - Fetch vendor's surcharges
   - Add any additional custom surcharges
   - Calculate total buy cost

5. **Apply Margin:**
   - Fetch margin rule (if provided)
   - Calculate sell price based on margin %

6. **Store Quote:**
   - Save to `quotes` table (if exists)
   - Link to `lcl_shipment_item` records
   - Return detailed breakdown

---

## 🛠️ Technical Considerations

### Tenant Isolation
- All queries MUST filter by `tenant_id`
- Use RLS policies to enforce at DB level
- JWT token must contain `tenant_id`

### Audit Logging
- Log all CUD operations to `rms_audit_log`
- Capture: `user_id`, `tenant_id`, `action`, `old_data`, `new_data`

### Error Handling
- Validate all foreign keys (vendor_id, charge_code, etc.)
- Return user-friendly error messages
- Log detailed errors for debugging

### Performance
- Use indexes on: `origin_code`, `destination_code`, `vendor_id`, `valid_from`, `valid_to`
- Cache vendor logos in static resources
- Batch fetch surcharges (avoid N+1 queries)

### Integration with Existing FCL/Haulage
- LCL is separate domain (separate tables)
- No overlap with `ocean_freight_rate` (FCL)
- Can coexist with inland haulage for door-to-door LCL

---

## 📦 Deliverables for Tomorrow

### Backend (Node.js)
1. ✅ 18 CRUD endpoints for 3 LCL tables
2. ✅ `POST /api/v4/search-lcl-rates` endpoint
3. ✅ `POST /api/v4/prepare-lcl-quote` endpoint
4. ✅ Audit logging for all operations
5. ✅ Error handling and validation

### Testing
1. ✅ Postman/curl tests for all endpoints
2. ✅ Test SLAB_BASED vs FLAT_RATE pricing
3. ✅ Test surcharge calculations (flat + percentage)
4. ✅ Test minimum charge enforcement
5. ✅ Test bulk operations

### Documentation
1. ✅ Update `API_DOCUMENTATION_V4.md` with LCL endpoints
2. ✅ Add request/response examples
3. ✅ Document pricing calculation logic

---

## 🚀 Next Steps (Day After Tomorrow)

### Salesforce LWC for LCL Management
1. Create `rmsLclRatesTable` component (similar to Ocean Freight)
2. Create `rmsLclSurchargesTable` component
3. Add to `rmsManagement` as new tabs
4. Integrate with modal form for CRUD

### LCL Quote UI
1. Add LCL option to existing quote/enquiry flow
2. "Add Package" interface for items (dimensions + weight)
3. Display chargeable weight calculation
4. Show slab breakdown for SLAB_BASED rates

---

## 📊 Progress Tracking

| Task | Status | Time Est. | Actual |
|------|--------|-----------|--------|
| Database Schema | ✅ Complete | 2h | 3h |
| Pricing Function | ✅ Complete | 1h | 1.5h |
| CRUD APIs (3 tables) | ⏳ Pending | 4h | - |
| Search Rates API | ⏳ Pending | 3h | - |
| Prepare Quote API | ⏳ Pending | 3h | - |
| Testing & Documentation | ⏳ Pending | 2h | - |

**Total Estimated**: 10 hours for full LCL API layer

---

## 🎯 Success Criteria

✅ All LCL CRUD endpoints working  
✅ Search rates returns correct slab match  
✅ Chargeable weight calculated correctly  
✅ Surcharges applied (flat + percentage)  
✅ Minimum charge enforced  
✅ Quote generation working end-to-end  
✅ Audit logs captured  
✅ API documentation updated  

---

**Ready to start tomorrow!** 🚀

