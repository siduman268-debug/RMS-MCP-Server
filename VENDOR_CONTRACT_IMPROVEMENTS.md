# Vendor & Contract Card UI Improvements

## Summary of Changes

Enhanced the Ocean Freight LWC with beautiful card-based selection for vendors and contracts, including vendor logos and auto-generated contract numbers.

## 🔧 Database Changes

### 1. Add `contract_number` Field
**File:** `add_contract_number_field.sql`

**Format:** `{vendor_id}-{SPOT/CNTR}-{YYYYMM}-{sequence}`

**Examples:**
- `3-SPOT-202510-003` → Maersk SPOT (Oct 2025)
- `3-CNTR-202501-013` → Maersk CONTRACT (Jan 2025)
- `2-SPOT-202510-002` → ACME Lines SPOT (Oct 2025)

**Features:**
- Auto-generated on insert via trigger
- Unique per tenant
- Human-readable format
- Includes vendor ID, contract type, and date

### 2. API Enhancements

**Updated Endpoint:** `GET /api/contracts`

**New Response Fields:**
```json
{
  "id": 3,
  "contract_number": "3-SPOT-202510-003",
  "name": "Maersk SPOT",
  "vendor_id": 3,
  "vendor_name": "Maersk",           ← NEW
  "vendor_code": "MSK",              ← NEW (if added)
  "vendor_logo": "https://...",      ← NEW
  "effective_from": "2025-10-07",
  "effective_to": "2026-01-05",
  "is_spot": true,
  "currency": "USD",
  "tenant_id": "..."
}
```

**Implementation:**
- Uses Supabase foreign key relationship to JOIN vendor data
- Flattens nested vendor object into top-level fields
- Orders by `contract_number` for better display

## 🎨 UI Enhancements

### Vendor Cards
```
┌──────────────┐
│ ✓            │ ← Selection indicator
│  [MSK Logo]  │ ← Real logo or initials
│              │
│   Maersk     │ ← Vendor name
│ Ocean Carrier│ ← Vendor type
└──────────────┘
```

**Features:**
- Clickable card selection
- Vendor logos from database
- Fallback gradient initials (e.g., "MA" for Maersk)
- Hover animation (lift + shadow)
- Blue border + checkmark when selected
- Formatted vendor type ("Ocean Carrier" vs "OCEAN_CARRIER")

### Contract Cards
```
┌─────────────────────────────┐
│ 3-SPOT-202510-003     SPOT  │ ← Contract number + Badge
│                             │
│ 🏢 Maersk                   │ ← Vendor name
│ 📅 Oct 7, 2025 - Jan 5, 2026│ ← Formatted dates
│ 💰 USD                       │ ← Currency
└─────────────────────────────┘
```

**Features:**
- Displays contract_number as primary identifier
- Shows vendor name (from API join)
- Color-coded badges:
  - Yellow for SPOT contracts
  - Blue for CONTRACT contracts
- Formatted dates ("Oct 7, 2025" vs "2025-10-07")
- Click to select/deselect
- Blue border + checkmark when selected

## 📂 Files Modified

### 1. Backend (API)
- **src/index.ts**
  - Updated `/api/contracts` to join vendor table
  - Added `vendor_name`, `vendor_code`, `vendor_logo` to response
  - Changed ordering to `contract_number`

### 2. Database
- **add_contract_number_field.sql**
  - New migration script
  - Adds `contract_number` column
  - Creates `generate_contract_number()` function
  - Creates trigger for auto-generation on insert
  - Updates existing records with generated numbers

### 3. Frontend (LWC)
- **force-app/main/default/lwc/rmsOceanFreight/rmsOceanFreight.html**
  - Changed from dropdown comboboxes to card grids
  - Added vendor cards with logos/initials
  - Added contract cards with number and vendor name
  - Added section headers with counts

- **force-app/main/default/lwc/rmsOceanFreight/rmsOceanFreight.js**
  - Added `formattedVendors` getter
  - Added `formattedContracts` getter with `displayName` and `displayVendor`
  - Added `getInitials()` for logo fallback
  - Added `formatVendorType()` for display
  - Added `formatDate()` for readable dates
  - Added `handleVendorCardClick()` and `handleContractCardClick()`

- **force-app/main/default/lwc/rmsOceanFreight/rmsOceanFreight.css**
  - Added card grid styles
  - Added hover animations
  - Added selection indicators
  - Added badge styles (SPOT/CONTRACT)
  - Added logo/placeholder styles

## 🚀 Deployment Steps

### Step 1: Run SQL Migration
```bash
# Connect to Supabase
psql -h <your-host> -U postgres -d postgres

# Run migration
\i add_contract_number_field.sql

# Verify
SELECT id, contract_number, name, vendor_id 
FROM rate_contract 
ORDER BY contract_number;
```

### Step 2: Deploy Backend to VM
```bash
git add .
git commit -m "feat: add vendor name to contract API and auto-generate contract numbers"
git push origin master

# On VM
ssh your-vm
cd ~/rms-mcp-server
git pull origin master
docker-compose down
docker-compose build
docker-compose up -d

# Verify
curl -X GET "http://localhost:3000/api/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001"
```

### Step 3: Deploy Frontend to Salesforce
```bash
# From local machine
sf project deploy start \
  --source-dir force-app/main/default/lwc/rmsOceanFreight \
  --target-org RMS-Scratch-Org
```

### Step 4: Test in Salesforce
1. Navigate to RMS Management app
2. Go to "Ocean Freight" tab
3. Verify vendor cards display with logos
4. Click a vendor card → verify contract cards load
5. Verify contract cards show:
   - Contract number (e.g., "3-SPOT-202510-003")
   - Vendor name (e.g., "Maersk")
   - Formatted dates
   - SPOT/CONTRACT badge
6. Click a contract card → verify selection
7. Click "Fetch Rates" → verify data loads

## 📊 Expected Results

### Contract API Response (Before)
```json
{
  "id": 3,
  "name": "Maersk SPOT",
  "vendor_id": 3,
  "effective_from": "2025-10-07",
  "effective_to": "2026-01-05",
  "is_spot": true
}
```

### Contract API Response (After)
```json
{
  "id": 3,
  "contract_number": "3-SPOT-202510-003",
  "name": "Maersk SPOT",
  "vendor_id": 3,
  "vendor_name": "Maersk",
  "vendor_code": null,
  "vendor_logo": "https://logos-world.net/wp-content/uploads/2022/09/Maersk-Emblem.png",
  "effective_from": "2025-10-07",
  "effective_to": "2026-01-05",
  "is_spot": true,
  "currency": "USD",
  "tenant_id": "00000000-0000-0000-0000-000000000001"
}
```

### UI Display

**Vendor Card (Before):**
```
[Dropdown] Maersk ▼
```

**Vendor Card (After):**
```
┌─────────────┐
│ ✓           │
│ [MSK Logo]  │
│  Maersk     │
│Ocean Carrier│
└─────────────┘
```

**Contract Card (Before):**
```
[Dropdown] Maersk SPOT - Valid: 2025-10-07 to 2026-01-05 (SPOT) ▼
```

**Contract Card (After):**
```
┌──────────────────────────────┐
│ 3-SPOT-202510-003      SPOT  │
│ 🏢 Maersk                    │
│ 📅 Oct 7, 2025 - Jan 5, 2026 │
│ 💰 USD                        │
└──────────────────────────────┘
```

## ✅ Verification Checklist

- [ ] SQL migration runs without errors
- [ ] Contract numbers generated for all existing records
- [ ] New contract inserts auto-generate contract number
- [ ] API returns vendor_name in contract response
- [ ] Vendor cards display with logos
- [ ] Contract cards show contract number
- [ ] Contract cards show vendor name
- [ ] Selection indicators work (click to select/deselect)
- [ ] Fetch rates works with selected vendor/contract
- [ ] UI is responsive and looks professional

## 🔍 Troubleshooting

### Issue: Contract numbers are NULL
```sql
-- Manually regenerate
UPDATE rate_contract
SET contract_number = generate_contract_number(vendor_id, is_spot, effective_from, id)
WHERE contract_number IS NULL;
```

### Issue: API returns vendor as nested object
Check the API is flattening the vendor object:
```typescript
const formattedData = (data || []).map(contract => {
    const vendor = contract.vendor;
    delete contract.vendor;
    return { ...contract, vendor_name: vendor?.name || null };
});
```

### Issue: Contract cards not showing vendor name
1. Check API response includes `vendor_name`
2. Check LWC JavaScript has `displayVendor` in `formattedContracts`
3. Check HTML template uses `{contract.displayVendor}`

## 📝 Notes

- Contract numbers are generated using the contract ID, so they're unique
- The YYYYMM format helps identify when contracts were created
- Vendor name is fetched via Supabase foreign key relationship
- Logo URLs are already in the database for major carriers
- Fallback initials use first 2 letters or first letter of each word

## 🎯 Future Enhancements

1. **Vendor Code**: Add optional short code (e.g., "MSK" for Maersk)
2. **Search**: Add search bar to filter vendors/contracts
3. **Favorites**: Star frequently used items
4. **Sorting**: Sort by name, type, date
5. **Contract Preview**: Hover tooltip with more details
6. **Logo Upload**: Allow admins to upload vendor logos
7. **Bulk Actions**: Select multiple contracts at once

