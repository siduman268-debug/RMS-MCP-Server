# V4 API Response Structures

## Complete JSON Response Examples

All responses have been saved to JSON files in the `test/` directory for easy reference.

---

## 1. V4 Search Rates - Regular Port

**Endpoint:** `POST /api/v4/search-rates`  
**Request:**
```json
{
  "origin": "INNSA",
  "destination": "NLRTM",
  "container_type": "40HC"
}
```

**Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "vendor": "Maersk",
      "route": "Nhava Sheva (INNSA) → Rotterdam (NLRTM)",
      "origin": "INNSA",                    // ✅ NEW field
      "destination": "NLRTM",              // ✅ NEW field
      "container_type": "40HC",
      "transit_days": 20,
      "pricing": {
        "ocean_freight_buy": 2000,
        "freight_surcharges": 300,
        "all_in_freight_buy": 2300,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 230
        },
        "all_in_freight_sell": 2530,
        "currency": "USD"
      },
      "validity": {
        "from": "2025-10-07",
        "to": "2026-01-05"
      },
      "is_preferred": false,
      "rate_id": 74,
      "inland_haulage": {                  // ✅ NEW - Always included
        "ihe_charges": {
          "found": false,
          "message": "Origin is not inland, no IHE needed"
        },
        "ihi_charges": {
          "found": false,
          "message": "Destination is not inland, no IHI needed"
        },
        "total_haulage_usd": 0
      }
    }
  ],
  "metadata": {
    "api_version": "v4",
    "generated_at": "2025-11-07T06:37:09.433Z"
  }
}
```

**Key Fields:**
- ✅ `origin` / `destination` (NEW - V4 field names)
- ✅ `rate_id` (for prepare-quote)
- ✅ `inland_haulage` (always included, even if not needed)
- ✅ All pricing fields
- ✅ Validity dates

---

## 2. V4 Search Rates - With Inland Port

**Request:**
```json
{
  "origin": "INTKD",
  "destination": "NLRTM",
  "container_type": "40HC",
  "cargo_weight_mt": 10,
  "haulage_type": "carrier"
}
```

**Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "vendor": "Hapag-Lloyd",
      "route": "Tughlakabad (INTKD) → Rotterdam (NLRTM)",
      "origin": "INTKD",
      "destination": "NLRTM",
      "container_type": "40HC",
      "transit_days": 28,
      "pricing": {...},
      "validity": {...},
      "is_preferred": true,
      "rate_id": 166,
      "inland_haulage": {                  // ✅ Automatically calculated
        "ihe_charges": {
          "found": true,
          "rate_id": 3,
          "currency": "INR",
          "route_name": "Tughlakabad ICD to Nhava Sheva Port (Road)",
          "vendor_name": "Mahindra Logistics",
          "haulage_type": "IHE",
          "exchange_rate": 83.33333333333333,
          "total_amount_inr": 52000,
          "total_amount_usd": 624,
          "rate_per_container_inr": 52000
        },
        "ihi_charges": {
          "found": false,
          "message": "POD is not inland, no IHI needed"
        },
        "total_haulage_usd": 624           // ✅ Total haulage included
      }
    }
  ],
  "metadata": {...}
}
```

**Key Fields:**
- ✅ `inland_haulage.ihe_charges.found: true` (when origin is inland)
- ✅ `inland_haulage.ihe_charges.total_amount_usd` (haulage cost)
- ✅ `inland_haulage.total_haulage_usd` (total IHE + IHI)

---

## 3. V4 Search Rates - With Earliest Departure

**Request:**
```json
{
  "origin": "INNSA",
  "destination": "NLRTM",
  "container_type": "40HC",
  "include_earliest_departure": true
}
```

**Response includes:**
```json
{
  "earliest_departure": {                  // ✅ NEW - If requested
    "found": true,
    "carrier": "MAERSK",
    "etd": "2025-11-09T08:30:00+00:00",
    "planned_departure": "2025-11-09T08:30:00+00:00",
    "estimated_departure": "2025-11-09T08:30:00+00:00",
    "carrier_service_code": "461",
    "carrier_voyage_number": "544W",
    "vessel_name": "A. P. Moller",
    "transit_time_days": 3.4375
  }
}
```

---

## 4. V4 Prepare Quote - Regular Port

**Endpoint:** `POST /api/v4/prepare-quote`  
**Request:**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "rate_id": 74,
  "container_count": 1
}
```

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "salesforce_org_id": "00DBE000002eBzh",
    "route": {
      "origin": "INNSA",                   // ✅ NEW field
      "destination": "NLRTM",              // ✅ NEW field
      "container_type": "40HC",
      "container_count": 1
    },
    "quote_parts": {
      "ocean_freight": {
        "carrier": "Maersk",
        "all_in_freight_sell": 2530,
        "ocean_freight_buy": 2000,
        "freight_surcharges": 300,
        "margin": {
          "type": "pct",
          "percentage": 10,
          "amount": 230
        },
        "currency": "USD",
        "transit_days": 20,
        "validity": {
          "from": "2025-10-07",
          "to": "2026-01-05"
        },
        "is_preferred": false,
        "rate_id": 74
      },
      "origin_charges": {
        "charges": [],
        "total_local": 0,
        "total_usd": 0,
        "count": 0
      },
      "destination_charges": {
        "charges": [],
        "total_local": 0,
        "total_usd": 0,
        "count": 0
      },
      "other_charges": {
        "charges": [],
        "total_local": 0,
        "total_usd": 0,
        "count": 0
      }
    },
    "totals": {
      "ocean_freight_total": 2530,
      "origin_total_local": 0,
      "origin_total_usd": 0,
      "destination_total_local": 0,
      "destination_total_usd": 0,
      "other_total_local": 0,
      "other_total_usd": 0,
      "inland_haulage_total_usd": 0,       // ✅ NEW field
      "grand_total_usd": 2530,
      "currency": "USD",
      "fx_rates": {},
      "currencies_used": []
    },
    "quote_summary": {
      "route_display": "Nhava Sheva (INNSA) (INNSA) → Rotterdam (NLRTM) (NLRTM)",
      "container_info": "1x 40HC",
      "total_charges_breakdown": {
        "ocean_freight_usd": 2530,
        "local_charges_usd": 0,
        "inland_haulage_usd": 0           // ✅ NEW field
      },
      "vendor_info": {
        "carrier": "Maersk",
        "transit_days": 20
      },
      "currency_conversion": {
        "fx_rates_applied": {},
        "fx_date": "2025-11-07",
        "currencies_converted": []
      }
    },
    "inland_haulage": {                    // ✅ NEW - Always included
      "ihe_charges": {
        "found": false,
        "message": "Origin is not inland, no IHE needed"
      },
      "ihi_charges": {
        "found": false,
        "message": "Destination is not inland, no IHI needed"
      },
      "total_haulage_usd": 0
    },
    "earliest_departure": {                // ✅ NEW - Included by default
      "found": true,
      "carrier": "MAERSK",
      "etd": "2025-11-09T08:30:00+00:00",
      "planned_departure": "2025-11-09T08:30:00+00:00",
      "estimated_departure": "2025-11-09T08:30:00+00:00",
      "carrier_service_code": "461",
      "carrier_voyage_number": "544W",
      "vessel_name": "A. P. Moller",
      "transit_time_days": 3.4375
    },
    "metadata": {
      "generated_at": "2025-11-07T06:37:15.128Z",
      "origin": "INNSA",                   // ✅ NEW field
      "destination": "NLRTM",              // ✅ NEW field
      "container_type": "40HC",
      "container_count": 1,
      "rate_id": 74,                        // ✅ NEW field
      "api_version": "v4"
    }
  }
}
```

**Key Fields:**
- ✅ `route.origin` / `route.destination` (NEW - V4 field names)
- ✅ `totals.inland_haulage_total_usd` (NEW)
- ✅ `inland_haulage` object (always included)
- ✅ `earliest_departure` object (included by default)
- ✅ `metadata.rate_id` (NEW)
- ✅ All quote parts and totals

---

## 5. V4 Prepare Quote - With Inland Port

**Request:**
```json
{
  "salesforce_org_id": "00DBE000002eBzh",
  "rate_id": 166,
  "container_count": 1,
  "cargo_weight_mt": 10,
  "haulage_type": "carrier"
}
```

**Response includes:**
```json
{
  "totals": {
    "ocean_freight_total": 3104.75,
    "inland_haulage_total_usd": 624,       // ✅ Automatically included
    "grand_total_usd": 3728.75
  },
  "inland_haulage": {
    "ihe_charges": {
      "found": true,
      "rate_id": 3,
      "currency": "INR",
      "route_name": "Tughlakabad ICD to Nhava Sheva Port (Road)",
      "vendor_name": "Mahindra Logistics",
      "haulage_type": "IHE",
      "exchange_rate": 83.33333333333333,
      "total_amount_inr": 52000,
      "total_amount_usd": 624,
      "rate_per_container_inr": 52000
    },
    "ihi_charges": {
      "found": false,
      "message": "POD is not inland, no IHI needed"
    },
    "total_haulage_usd": 624
  },
  "quote_summary": {
    "total_charges_breakdown": {
      "ocean_freight_usd": 3104.75,
      "local_charges_usd": 0,
      "inland_haulage_usd": 624            // ✅ Included in breakdown
    }
  }
}
```

---

## Field Checklist

### V4 Search Rates Response
- [x] `success` - Boolean
- [x] `data[]` - Array of rates
  - [x] `vendor` - Carrier name
  - [x] `route` - Route display string
  - [x] `origin` - ✅ NEW - Origin port code
  - [x] `destination` - ✅ NEW - Destination port code
  - [x] `container_type` - Container type
  - [x] `transit_days` - Transit time
  - [x] `pricing` - Pricing breakdown
  - [x] `validity` - Validity dates
  - [x] `is_preferred` - Preferred flag
  - [x] `rate_id` - Rate identifier
  - [x] `inland_haulage` - ✅ NEW - Inland haulage details
    - [x] `ihe_charges` - Origin haulage
    - [x] `ihi_charges` - Destination haulage
    - [x] `total_haulage_usd` - Total haulage cost
  - [x] `earliest_departure` - ✅ NEW - If requested
- [x] `metadata` - API metadata

### V4 Prepare Quote Response
- [x] `success` - Boolean
- [x] `data` - Quote data
  - [x] `salesforce_org_id` - Salesforce org ID
  - [x] `route` - Route information
    - [x] `origin` - ✅ NEW - Origin port code
    - [x] `destination` - ✅ NEW - Destination port code
    - [x] `container_type` - Container type
    - [x] `container_count` - Container count
  - [x] `quote_parts` - Quote breakdown
    - [x] `ocean_freight` - Ocean freight details
    - [x] `origin_charges` - Origin charges
    - [x] `destination_charges` - Destination charges
    - [x] `other_charges` - Other charges
  - [x] `totals` - Totals
    - [x] `ocean_freight_total` - Ocean freight total
    - [x] `origin_total_usd` - Origin charges total
    - [x] `destination_total_usd` - Destination charges total
    - [x] `inland_haulage_total_usd` - ✅ NEW - Inland haulage total
    - [x] `grand_total_usd` - Grand total
    - [x] `currency` - Currency
    - [x] `fx_rates` - FX rates
    - [x] `currencies_used` - Currencies used
  - [x] `quote_summary` - Quote summary
    - [x] `route_display` - Route display
    - [x] `container_info` - Container info
    - [x] `total_charges_breakdown` - Charges breakdown
      - [x] `inland_haulage_usd` - ✅ NEW - Inland haulage in breakdown
    - [x] `vendor_info` - Vendor information
    - [x] `currency_conversion` - Currency conversion info
  - [x] `inland_haulage` - ✅ NEW - Inland haulage details
  - [x] `earliest_departure` - ✅ NEW - Earliest departure info
  - [x] `metadata` - Metadata
    - [x] `origin` - ✅ NEW - Origin port code
    - [x] `destination` - ✅ NEW - Destination port code
    - [x] `rate_id` - ✅ NEW - Rate ID used
    - [x] `api_version` - API version

---

## JSON Files Saved

All responses have been saved to:
- ✅ `test/v4-search-rates-response.json` - Regular port search
- ✅ `test/v4-prepare-quote-response.json` - Regular port quote
- ✅ `test/v4-search-rates-inland-response.json` - Inland port search
- ✅ `test/v4-prepare-quote-inland-response.json` - Inland port quote

You can review these files to verify all required fields are present!

