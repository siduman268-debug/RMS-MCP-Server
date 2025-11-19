# Tomorrow's Implementation Plan - November 20, 2025

## 🎯 **TWO MAJOR FEATURES TO IMPLEMENT**

---

## 📦 **FEATURE 1: INLAND HAULAGE MANAGEMENT**

### Overview
Create a comprehensive tab to manage inland haulage with 4 interconnected tables:
1. **Haulage Route** - Master route definitions
2. **Haulage Rate** - Pricing for routes
3. **Haulage Leg** - Individual segments of routes
4. **Haulage Responsibility** - Who handles which part

### Database Analysis Required
- [ ] Run `check_haulage_schema.sql` to understand:
  - Table structures and columns
  - Foreign key relationships
  - CHECK constraints and enums
  - Sample data patterns
  - Multi-tenancy setup (tenant_id presence)

### Implementation Steps

#### Phase 1: Backend API (Node.js)
**File**: `src/index.ts`

1. **Haulage Route APIs**
   - `GET /api/haulage-routes` - List all routes with filters
   - `POST /api/haulage-routes` - Create new route
   - `PUT /api/haulage-routes/:routeId` - Update route
   - `DELETE /api/haulage-routes/:routeId` - Delete route
   - `GET /api/haulage-routes/:routeId` - Get single route

2. **Haulage Rate APIs**
   - `GET /api/haulage-rates` - List rates (filter by route_id)
   - `POST /api/haulage-rates` - Create rate
   - `PUT /api/haulage-rates/:rateId` - Update rate
   - `DELETE /api/haulage-rates/:rateId` - Delete rate

3. **Haulage Leg APIs**
   - `GET /api/haulage-legs` - List legs (filter by route_id)
   - `POST /api/haulage-legs` - Create leg
   - `PUT /api/haulage-legs/:legId` - Update leg
   - `DELETE /api/haulage-legs/:legId` - Delete leg

4. **Haulage Responsibility APIs**
   - `GET /api/haulage-responsibilities` - List responsibilities
   - `POST /api/haulage-responsibilities` - Create responsibility
   - `PUT /api/haulage-responsibilities/:respId` - Update responsibility
   - `DELETE /api/haulage-responsibilities/:respId` - Delete responsibility

**All APIs must include**:
- ✅ Tenant ID enforcement
- ✅ Audit logging via `logAudit()`
- ✅ Error handling
- ✅ Validation
- ✅ JOIN queries for related data

#### Phase 2: Salesforce Apex Services
**Files**: `force-app/main/default/classes/`

Create Apex service classes:
1. `RMSHaulageRouteService.cls`
2. `RMSHaulageRateService.cls`
3. `RMSHaulageLegService.cls`
4. `RMSHaulageResponsibilityService.cls`

Each with `@AuraEnabled` methods for CRUD operations.

#### Phase 3: LWC Schema Constants
**File**: `force-app/main/default/lwc/rmsSchemaConstants/rmsSchemaConstants.js`

Add:
```javascript
export const HAULAGE_ROUTE_FIELDS = { /* ... */ };
export const HAULAGE_RATE_FIELDS = { /* ... */ };
export const HAULAGE_LEG_FIELDS = { /* ... */ };
export const HAULAGE_RESPONSIBILITY_FIELDS = { /* ... */ };
```

#### Phase 4: LWC Components

**Option A: Master-Detail View** (Recommended)
- Main component: `rmsHaulageManagement`
  - Top section: Route list/cards
  - Bottom section (tabs):
    - Rates for selected route
    - Legs for selected route
    - Responsibilities for selected route

**Option B: Separate Sub-tabs**
- `rmsHaulageRoutes` (main list)
- `rmsHaulageRates` (table)
- `rmsHaulageLegs` (table)
- `rmsHaulageResponsibilities` (table)

#### Phase 5: UI/UX Design
- **Routes**: Card-based UI (like Vendors/Contracts)
  - Show route name, origin/destination, active status
  - Quick actions: View Rates, View Legs, Edit, Delete
  
- **Rates**: Table-based UI
  - Columns: Container Type, Rate Amount, Currency, Valid From/To
  - Filters: Route, Container Type, Date Range
  
- **Legs**: Table-based UI
  - Columns: Sequence, From Location, To Location, Mode, Distance
  - Sortable by sequence
  
- **Responsibilities**: Table-based UI
  - Columns: Party Type, Responsibility Type, Leg
  - Filters: Party Type, Responsibility Type

#### Phase 6: Testing
- [ ] Create sample routes
- [ ] Add rates to routes
- [ ] Define legs for routes
- [ ] Assign responsibilities
- [ ] Test CRUD on all 4 entities
- [ ] Verify audit logging
- [ ] Check relationships/cascades

---

## 📤 **FEATURE 2: CENTRALIZED BULK UPLOAD**

### Overview
Single tab for uploading CSV files for ALL entity types (Vendors, Contracts, Ocean Freight, Surcharges, Margin Rules, Haulage entities).

### User Flow
1. User selects entity type from dropdown (e.g., "Vendors", "Contracts", etc.)
2. System displays:
   - CSV template download link
   - Expected format documentation
   - Example data preview
3. User drags and drops CSV file OR clicks to browse
4. System validates:
   - File format (must be CSV)
   - Column headers match template
   - Data types are correct
   - Required fields present
   - FK references valid (e.g., vendor_id exists)
5. System shows preview of data to be uploaded
6. User confirms upload
7. System processes:
   - Inserts valid records
   - Logs errors for invalid records
   - Shows summary: X successful, Y failed
   - Provides downloadable error report

### Implementation Steps

#### Phase 1: Backend APIs
**File**: `src/index.ts`

1. **Template Download**
   - `GET /api/bulk-upload/template/:entityType` - Returns CSV template

2. **Validation**
   - `POST /api/bulk-upload/validate` - Validates CSV without inserting
   - Returns validation report with errors

3. **Upload**
   - `POST /api/bulk-upload/process` - Validates and inserts
   - Returns detailed results

4. **Sample Data**
   - `GET /api/bulk-upload/sample/:entityType` - Returns sample CSV data

**Supported Entity Types**:
- `vendors`
- `contracts`
- `ocean_freight`
- `surcharges`
- `margin_rules`
- `haulage_routes`
- `haulage_rates`
- `haulage_legs`
- `haulage_responsibilities`

#### Phase 2: CSV Templates
**Create**: `csv_templates/` directory with:
- `vendor_template.csv`
- `contract_template.csv`
- `ocean_freight_template.csv`
- `surcharge_template.csv`
- `margin_rule_template.csv`
- `haulage_route_template.csv`
- `haulage_rate_template.csv`
- `haulage_leg_template.csv`
- `haulage_responsibility_template.csv`

Each with:
- Header row with exact column names
- 2-3 example rows
- Comments explaining formats

#### Phase 3: Validation Rules
**Per Entity Type**:
- Required fields validation
- Data type validation (dates, numbers, UUIDs)
- Enum validation (status, mode, etc.)
- FK validation (vendor exists, contract exists, location exists)
- Business logic validation (valid_from < valid_to, etc.)
- Duplicate detection

#### Phase 4: Salesforce LWC
**Component**: `rmsBulkUpload`

**Features**:
1. **Entity Type Selector**
   - Dropdown with all entity types
   - On change: Shows relevant documentation

2. **Documentation Panel**
   - Required fields list
   - Format examples
   - Download template button
   - View sample data button

3. **Upload Area**
   - Drag-and-drop zone (styled with SLDS)
   - File browser button
   - File size limit display (e.g., max 5MB)
   - Accepted formats: `.csv` only

4. **Preview Section**
   - Shows first 10 rows of uploaded CSV
   - Highlights validation errors (red)
   - Shows row numbers

5. **Validation Results**
   - Summary: X valid, Y invalid rows
   - Expandable error list
   - Option to download full error report

6. **Upload Actions**
   - "Validate Only" button - Check without inserting
   - "Upload" button - Validate and insert
   - "Cancel" button - Clear upload

7. **Progress Indicator**
   - Spinner during validation/upload
   - Progress bar for large files
   - Success/error toast messages

#### Phase 5: CSV Parser
**Use**: `papaparse` library (client-side) or `csv-parser` (server-side)

**Parsing Logic**:
```javascript
// Client-side (LWC)
Papa.parse(file, {
    header: true, // First row as keys
    skipEmptyLines: true,
    complete: function(results) {
        // results.data = array of objects
        // results.errors = parsing errors
    }
});
```

**Server-side (Node.js)**:
```javascript
const csv = require('csv-parser');
const results = [];
fs.createReadStream('file.csv')
  .pipe(csv())
  .on('data', (row) => results.push(row))
  .on('end', () => { /* process results */ });
```

#### Phase 6: Error Reporting
**Error CSV Format**:
```csv
row_number,field,error_message,original_value
2,vendor_id,"Vendor not found: 999",999
3,valid_from,"Invalid date format. Expected YYYY-MM-DD","2024-13-01"
```

#### Phase 7: Documentation
**Create**: `BULK_UPLOAD_GUIDE.md`
- For each entity type:
  - Required fields
  - Optional fields
  - Field formats
  - Example CSV
  - Common errors
  - Best practices

---

## 📅 **IMPLEMENTATION TIMELINE (Tomorrow)**

### Morning Session (4-5 hours):
1. ✅ Run `check_haulage_schema.sql` and analyze results (30 min)
2. ✅ Create all Haulage APIs in `src/index.ts` (2 hours)
3. ✅ Create Haulage Apex services (1 hour)
4. ✅ Add Haulage schema constants (30 min)
5. ✅ Build and test APIs (1 hour)

### Afternoon Session (4-5 hours):
1. ✅ Create Haulage LWC components (2 hours)
2. ✅ Deploy and test Haulage tab (1 hour)
3. ✅ Create Bulk Upload backend APIs (1 hour)
4. ✅ Create CSV templates (30 min)
5. ✅ Build Bulk Upload LWC (30 min)

### Evening Session (2-3 hours):
1. ✅ Complete Bulk Upload UI (1 hour)
2. ✅ Test bulk upload for all entities (1 hour)
3. ✅ Documentation and Git commit (30 min)
4. ✅ Deploy to VM (30 min)

---

## 📋 **DELIVERABLES FOR TOMORROW**

### Code:
- [ ] 4 Haulage API endpoint groups (16 endpoints total)
- [ ] 4 Haulage Apex service classes
- [ ] 1 Haulage LWC tab with sub-components
- [ ] 3 Bulk Upload API endpoints
- [ ] 1 Bulk Upload LWC component
- [ ] 9 CSV templates
- [ ] Validation logic for all entity types

### Documentation:
- [ ] Haulage schema analysis results
- [ ] Haulage API documentation
- [ ] Bulk Upload user guide
- [ ] CSV format specifications

### Testing:
- [ ] All Haulage CRUD operations working
- [ ] Audit logging for Haulage
- [ ] Bulk upload validation working
- [ ] Error reporting functional
- [ ] Sample uploads successful

---

## 🚀 **PREPARATION FOR TOMORROW**

### Before Starting:
1. ✅ Review `check_haulage_schema.sql` output
2. ✅ Understand haulage table relationships
3. ✅ Plan UI layout (master-detail vs tabs)
4. ✅ Install CSV parsing library if needed:
   ```bash
   npm install csv-parser papaparse
   ```

### During Implementation:
1. ✅ Follow same patterns as existing entities
2. ✅ Apply lessons learned from Vendors/Contracts/Surcharges/Margin Rules
3. ✅ Add audit logging from the start
4. ✅ Test as you build (not at the end)
5. ✅ Commit frequently to Git

### Key Success Factors:
- **Reuse existing patterns** - Don't reinvent the wheel
- **Master-Detail relationships** - Haulage tables are interconnected
- **Robust validation** - Bulk upload must handle errors gracefully
- **Clear documentation** - Users need help with CSV formats
- **Incremental testing** - Test each API before moving to next

---

## 📊 **COMPLEXITY ASSESSMENT**

### Haulage Management: **Medium-High**
- 4 interconnected tables
- Master-detail relationships
- Sequence ordering (legs)
- Complex UI (master-detail view)

### Bulk Upload: **High**
- CSV parsing and validation
- Multi-entity support (9 entity types)
- Error handling and reporting
- Preview and confirmation flow
- File upload handling

**Total Estimated Effort**: 10-12 hours (Full day of focused work) 💪

---

## 🎯 **STRETCH GOALS (If Time Permits)**

1. **Bulk Update** - Upload CSV to update existing records (not just create)
2. **Excel Support** - Accept `.xlsx` in addition to `.csv`
3. **Scheduled Uploads** - Upload now or schedule for later
4. **Template Customization** - Let admins customize CSV templates
5. **Bulk Delete** - Upload list of IDs to delete
6. **Haulage Route Visualization** - Map view of legs

---

**Ready to POWER THROUGH tomorrow!** 🚀💪🔥

Let's build these features and make the RMS system even more powerful! 🎉

