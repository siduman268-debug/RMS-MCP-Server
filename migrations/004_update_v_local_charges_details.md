# Update v_local_charges_details View

## Overview
Add `origin_code`, `destination_code`, `origin_name`, `destination_name` columns to `v_local_charges_details` view, similar to what we did for `mv_freight_sell_prices`.

## Current Usage

The view is used in:
- V1/V2/V3 Prepare Quote endpoints (filters by `pol_id`/`pod_id`)
- V4 Prepare Quote endpoint (filters by `pol_id`/`pod_id`)
- Some endpoints use `origin_port_code`/`destination_port_code`

## Required Columns to Keep

Based on code analysis, the view must have:
- `contract_id` - for filtering
- `pol_id` - for filtering origin charges
- `pod_id` - for filtering destination charges
- `vendor_id` - for filtering
- `charge_location_type` - 'Origin Charges' or 'Destination Charges'
- `origin_port_code` - used in some queries
- `destination_port_code` - used in some queries
- All charge detail columns (charge_code, charge_amount, etc.)

## Migration Steps

1. Get current view definition:
```sql
SELECT pg_get_viewdef('v_local_charges_details', true);
```

2. Add these 4 new columns:
- `origin_code` - from locations table (where pol_id matches)
- `destination_code` - from locations table (where pod_id matches)
- `origin_name` - from locations table (where pol_id matches)
- `destination_name` - from locations table (where pod_id matches)

3. Keep ALL existing columns

## Template

The view likely joins `surcharge` table with `locations` table. Add the new columns similar to how we did for `mv_freight_sell_prices`.

