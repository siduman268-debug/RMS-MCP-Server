# RMS Ocean Freight UI Upgrade - Card-Based Design

## 🎨 Overview

Upgraded the Ocean Freight LWC from simple dropdown filters to a beautiful card-based selection interface with vendor logos and contract details.

## ✨ New Features

### 1. **Vendor Card Selection**
- **Visual Card Grid**: Vendors displayed as clickable cards with logos
- **Carrier Logos**: Real vendor logos from database
- **Fallback Initials**: Auto-generated colored badges for vendors without logos
- **Selection Indicator**: Blue checkmark badge on selected vendor
- **Hover Effects**: Cards lift and highlight on hover
- **Vendor Type Badge**: Shows "Ocean Carrier", "Haulage Road", etc.

### 2. **Contract Card Selection**
- **Contract Information Cards**: Show contract name, type, dates, currency
- **SPOT vs CONTRACT Badges**: Color-coded badges (yellow for SPOT, blue for CONTRACT)
- **Date Display**: Formatted "Oct 7, 2025 - Jan 5, 2026"
- **Selection Indicator**: Blue checkmark badge on selected contract
- **Conditional Display**: Contracts only show after vendor selection

### 3. **Enhanced User Experience**
- **Grid Layout**: Responsive grid that auto-fits cards
- **Scrollable Containers**: Max height with smooth scrolling
- **Empty States**: Friendly messages when no data available
- **Section Headers**: Shows "X Available" count for vendors/contracts
- **Toggle Selection**: Click again to deselect

## 📦 Database Changes Required

### Add `vendor_code` to `vendor` table:
```sql
-- Run: add_vendor_contract_fields.sql
ALTER TABLE vendor ADD COLUMN vendor_code TEXT;
```

**Example Results:**
- Maersk → MSK
- MSC → MSC
- CMA CGM → CMA
- Hapag-Lloyd → HLCU

### Add `contract_number` to `rate_contract` table:
```sql
ALTER TABLE rate_contract ADD COLUMN contract_number TEXT;
```

**Example Results:**
- SPOT-MSK-2025
- CNTR-MSK-2025-0013
- SPOT-ACME-2025

## 🎯 Implementation Details

### Files Modified:
1. **force-app/main/default/lwc/rmsOceanFreight/rmsOceanFreight.html**
   - Replaced dropdown comboboxes with card grids
   - Added vendor cards container with logos and initials
   - Added contract cards container with badges and details
   - Added section headers with counts

2. **force-app/main/default/lwc/rmsOceanFreight/rmsOceanFreight.js**
   - Added `formattedVendors` getter for card data
   - Added `formattedContracts` getter for card data
   - Added `getInitials()` method for fallback logos
   - Added `formatVendorType()` method for display names
   - Added `formatDate()` method for readable dates
   - Added `handleVendorCardClick()` for card selection
   - Added `handleContractCardClick()` for card selection

3. **force-app/main/default/lwc/rmsOceanFreight/rmsOceanFreight.css**
   - Added `.vendor-cards-container` grid styles
   - Added `.vendor-card` hover and selection styles
   - Added `.vendor-logo` and `.vendor-logo-placeholder` styles
   - Added `.contract-cards-container` grid styles
   - Added `.contract-card` hover and selection styles
   - Added `.contract-badge` (SPOT/CONTRACT) styles
   - Added `.selected-indicator` checkmark badge styles
   - Added scrollbar styling for containers

## 🎨 Design Elements

### Color Scheme:
- **Primary Blue**: `#0176d3` (selection borders)
- **Light Blue**: `#f3f9ff` (selected background)
- **Yellow Badge**: `#fef3c7` background, `#92400e` text (SPOT)
- **Blue Badge**: `#dbeafe` background, `#1e40af` text (CONTRACT)
- **Neutral**: `#f3f3f3` (section headers)

### Card Hover Animation:
```css
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(1, 118, 211, 0.15);
```

### Logo Placeholder Gradient:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

## 📊 UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ SELECT VENDOR & CONTRACT                                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🏢 Select Vendor                   18 Available     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│ │ MSK  │  │ MSC  │  │ CMA  │  │ HLCU │  │ ONE  │ ... │
│ │Logo  │  │Logo  │  │Logo  │  │Logo  │  │Logo  │     │
│ │Maersk│  │ MSC  │  │CMA   │  │Hapag │  │ ONE  │     │
│ │Ocean │  │Ocean │  │Ocean │  │Lloyd │  │Ocean │     │
│ │Carrier│ │Carrier│ │Carrier│ │Ocean │  │Carrier│    │
│ └──────┘  └──────┘  └──────┘  │Carrier│ └──────┘     │
│                                └──────┘                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 Select Contract                  20 Available    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌───────────────────────┐  ┌───────────────────────┐  │
│ │ Maersk SPOT      SPOT │  │ Maersk CONTRACT  CNTR│  │
│ │ 📅 Oct 7 - Jan 5      │  │ 📅 Jan 1 - Dec 31    │  │
│ │ 💰 USD                │  │ 💰 USD               │  │
│ └───────────────────────┘  └───────────────────────┘  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Origin / Destination / Container Type Filters       │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Deployment Steps

1. **Run SQL Migration**:
   ```bash
   # Connect to Supabase and run
   psql -h <your-supabase-host> -U postgres -d postgres < add_vendor_contract_fields.sql
   ```

2. **Deploy Updated LWC**:
   ```bash
   sf project deploy start --source-dir force-app/main/default/lwc/rmsOceanFreight --target-org RMS-Scratch-Org
   ```

3. **Rebuild and Deploy Docker** (if using VM):
   ```bash
   git add .
   git commit -m "feat: add card-based vendor/contract selection with logos"
   git push origin master
   
   # On VM
   cd ~/rms-mcp-server
   git pull origin master
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

4. **Test in Salesforce**:
   - Navigate to RMS Management app
   - Go to "Ocean Freight" tab
   - Verify vendor cards display with logos
   - Verify contract cards display correctly
   - Test selection and deselection
   - Verify "Fetch Rates" works with selected vendor/contract

## 🎯 Expected Behavior

1. **Initial Load**: Shows all vendors as cards
2. **Click Vendor Card**: 
   - Card gets blue border and checkmark
   - Contracts load for that vendor
3. **Click Contract Card**: 
   - Card gets blue border and checkmark
   - Ready to fetch rates
4. **Click Again**: Deselects the card
5. **Fetch Rates**: Uses selected vendor + contract + other filters

## 📸 Visual Examples

### Vendor Card (Selected):
```
┌─────────────────────┐
│ ✓                   │ ← Blue checkmark badge
│   [Maersk Logo]     │
│                     │
│   Maersk            │ ← Bold name
│   Ocean Carrier     │ ← Type badge
└─────────────────────┘
   ↑
   Blue border + shadow
```

### Contract Card (SPOT):
```
┌──────────────────────────────┐
│ Maersk SPOT           [SPOT] │ ← Yellow badge
│                               │
│ 📅 Oct 7, 2025 - Jan 5, 2026 │
│ 💰 USD                        │
└──────────────────────────────┘
```

## 🔧 Future Enhancements

1. **Search Bar**: Add search input to filter vendors by name
2. **Filter by Type**: Add tabs for Ocean Carrier, Haulage, etc.
3. **Favorites**: Star frequently used vendors/contracts
4. **Recently Used**: Show recently selected items at the top
5. **Logo Upload**: Allow admins to upload vendor logos
6. **Contract Preview**: Hover tooltip showing more contract details

## ✅ Testing Checklist

- [ ] SQL migration runs successfully
- [ ] Vendor cards display with logos
- [ ] Vendor cards without logos show initials
- [ ] Clicking vendor loads contracts
- [ ] Contract badges show correct type (SPOT/CONTRACT)
- [ ] Selection indicators work (checkmarks)
- [ ] Deselection works (click again)
- [ ] Rates fetch with selected vendor/contract
- [ ] Responsive layout works on different screen sizes
- [ ] Scrolling works smoothly in card containers

## 📝 Notes

- The `Logo_URL` field in the vendor table is already populated with carrier logos
- The fallback initials use a purple gradient placeholder
- Vendor types are formatted from snake_case to Title Case (e.g., `OCEAN_CARRIER` → "Ocean Carrier")
- Contract dates are formatted using `toLocaleDateString` for better readability
- All interactions are toggle-based (click to select, click again to deselect)

