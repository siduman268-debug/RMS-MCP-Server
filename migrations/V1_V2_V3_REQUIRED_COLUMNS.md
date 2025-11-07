# Required Columns for V1/V2/V3 APIs

## Analysis of Column Usage

Based on code analysis, here are the columns that V1, V2, V3 APIs **MUST** have in `mv_freight_sell_prices`:

---

## V1 Search Rates (`/api/search-rates`)

**Columns Used:**
- `pol_code` - for filtering
- `pod_code` - for filtering
- `carrier` - vendor name
- `pol_name` - port name for display
- `pod_name` - port name for display
- `container_type` - container type
- `transit_days` - transit time
- `ocean_freight_buy` - buy price
- `freight_surcharges` - surcharges
- `all_in_freight_buy` - all-in buy price
- `margin_type` - margin calculation type
- `margin_percentage` - margin percentage
- `margin_amount` - margin amount
- `all_in_freight_sell` - sell price
- `currency` - currency code
- `valid_from` - validity start date
- `valid_to` - validity end date
- `is_preferred` - preferred flag
- `rate_id` - rate identifier

---

## V1 Prepare Quote (`/api/prepare-quote`)

**Columns Used:**
- `pol_code` - for filtering
- `pod_code` - for filtering
- `container_type` - for filtering
- `is_preferred` - for filtering
- `contract_id` - **CRITICAL**: used to get local charges
- `pol_id` - **CRITICAL**: used to get origin charges
- `pod_id` - **CRITICAL**: used to get destination charges
- `vendor_id` - used for charge filtering
- All pricing columns (same as search-rates)

---

## V2 Search Rates (`/api/v2/search-rates`)

**Columns Used:**
- Same as V1 Search Rates (all columns listed above)

---

## V2 Prepare Quote (`/api/v2/prepare-quote`)

**Columns Used:**
- Same as V1 Prepare Quote (all columns listed above)

---

## V3 Prepare Quote (`/api/v3/prepare-quote`)

**Columns Used:**
- Same as V1 Prepare Quote (all columns listed above)

---

## Complete Required Column List

### Filtering/Query Columns:
- ✅ `pol_code` - Port of Loading UN/LOCODE
- ✅ `pod_code` - Port of Discharge UN/LOCODE
- ✅ `container_type` - Container type
- ✅ `is_preferred` - Preferred rate flag
- ✅ `rate_id` - Rate identifier

### Display Columns:
- ✅ `pol_name` - Port of Loading name
- ✅ `pod_name` - Port of Discharge name
- ✅ `carrier` - Vendor/carrier name

### Pricing Columns:
- ✅ `ocean_freight_buy` - Ocean freight buy price
- ✅ `freight_surcharges` - Freight surcharges
- ✅ `all_in_freight_buy` - All-in freight buy price
- ✅ `margin_type` - Margin type (pct/fixed)
- ✅ `margin_percentage` - Margin percentage
- ✅ `margin_amount` - Margin amount
- ✅ `all_in_freight_sell` - All-in freight sell price
- ✅ `currency` - Currency code

### Validity Columns:
- ✅ `valid_from` - Validity start date
- ✅ `valid_to` - Validity end date

### Relationship Columns (CRITICAL for local charges):
- ✅ `contract_id` - Contract ID (needed for local charges lookup)
- ✅ `pol_id` - Port of Loading ID (needed for origin charges)
- ✅ `pod_id` - Port of Discharge ID (needed for destination charges)
- ✅ `vendor_id` - Vendor ID (needed for charge filtering)

### Transit Columns:
- ✅ `transit_days` - Transit time in days

---

## Migration Checklist

When updating `mv_freight_sell_prices`, ensure:

- [ ] All existing columns are preserved
- [ ] `pol_code`, `pod_code` are kept (for V1/V2/V3)
- [ ] `pol_name`, `pod_name` are kept (for V1/V2/V3)
- [ ] `contract_id`, `pol_id`, `pod_id`, `vendor_id` are kept (CRITICAL!)
- [ ] All pricing columns are kept
- [ ] New columns added: `origin_code`, `destination_code`, `origin_name`, `destination_name`

---

## ⚠️ CRITICAL WARNING

**DO NOT REMOVE THESE COLUMNS:**
- `contract_id` - Without this, prepare-quote will fail
- `pol_id` - Without this, origin charges lookup will fail
- `pod_id` - Without this, destination charges lookup will fail
- `vendor_id` - Without this, charge filtering will fail

These are **relationship columns** that link to other tables. They are essential for the prepare-quote endpoints to work!

---

## Template for View Update

```sql
CREATE MATERIALIZED VIEW mv_freight_sell_prices AS
SELECT 
  -- IDENTIFIERS
  ofr.id as rate_id,
  
  -- OLD COLUMNS (V1/V2/V3) - MUST KEEP
  pol.unlocode as pol_code,
  pod.unlocode as pod_code,
  pol.name as pol_name,
  pod.name as pod_name,
  
  -- NEW COLUMNS (V4) - ADD THESE
  ofr.origin_code,
  ofr.destination_code,
  pol.name as origin_name,
  pod.name as destination_name,
  
  -- RELATIONSHIP COLUMNS (CRITICAL - MUST KEEP)
  ofr.contract_id,
  ofr.pol_id,
  ofr.pod_id,
  ofr.vendor_id,
  
  -- CONTAINER & CARRIER
  ofr.container_type,
  v.name as carrier,  -- or however you get carrier name
  
  -- PRICING (MUST KEEP)
  ofr.buy_amount as ocean_freight_buy,
  -- ... calculate freight_surcharges
  -- ... calculate all_in_freight_buy
  -- ... calculate margin_type, margin_percentage, margin_amount
  -- ... calculate all_in_freight_sell
  ofr.currency,
  
  -- VALIDITY (MUST KEEP)
  ofr.valid_from,
  ofr.valid_to,
  ofr.is_preferred,
  
  -- TRANSIT (MUST KEEP)
  ofr.tt_days as transit_days,
  
  -- ... ALL OTHER COLUMNS FROM YOUR ORIGINAL VIEW
  
FROM ocean_freight_rate ofr
JOIN locations pol ON pol.id = ofr.pol_id
JOIN locations pod ON pod.id = ofr.pod_id
-- ... all other JOINs from original view
WHERE ofr.is_active = true;
```

---

**Bottom Line**: Copy your EXISTING view definition completely, then ADD the 4 new columns. Don't remove anything!

