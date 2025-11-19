# RMS CRUD Implementation - Complete Action Plan

## 📋 **OBJECTIVE**
Enable full CRUD (Create, Read, Update, Delete) operations for all RMS tabs with:
- ✅ Working Create, Edit, Delete, CSV Upload, Export buttons
- ✅ Tab-specific actions (not global)
- ✅ Clear success/error messages
- ✅ Database audit trail for all changes
- ✅ Row-level actions that open full records for editing

---

## 🗂️ **DATABASE TABLES**

### Current Tables (Supabase):
1. **`vendor`** - Vendor master data
2. **`rate_contract`** - Rate contracts linked to vendors
3. **`ocean_freight_rate`** - Base ocean freight rates
4. **`surcharge`** - Freight surcharges
5. **`margin_rule_v2`** - Margin calculation rules
6. **`locations`** - Port/ICD master data (reference)
7. **`mv_freight_sell_prices`** - Materialized view (aggregated rates, read-only)

### Audit Table (TO CREATE):
**`rms_audit_log`** - Track all CRUD operations

```sql
CREATE TABLE rms_audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  user_id TEXT,
  user_email TEXT,
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT DEFAULT 'SALESFORCE_LWC'
);

CREATE INDEX idx_audit_tenant ON rms_audit_log(tenant_id);
CREATE INDEX idx_audit_table_record ON rms_audit_log(table_name, record_id);
CREATE INDEX idx_audit_timestamp ON rms_audit_log(timestamp DESC);
```

---

## 🏗️ **CURRENT ARCHITECTURE ISSUES**

### 1. **Button Placement Issues**
- ❌ Create, Upload CSV, Export buttons are at `rmsManagement` level (global)
- ✅ Should be at **individual tab component** level (tab-specific)

### 2. **Event Handling Issues**
- ❌ Events not bubbling correctly from child components to parent
- ❌ Entity type mismatch (e.g., `oceanFreight` vs `rates`)
- ❌ Record ID extraction failing

### 3. **Modal Form Issues**
- ❌ Schema constants might be missing for some entities
- ❌ Form not loading data correctly for edit mode
- ❌ Save functionality not connected properly

### 4. **API Issues**
- ✅ GET endpoints exist for all entities
- ⚠️ POST/PUT/DELETE endpoints exist but may have field name mismatches
- ❌ No audit logging on API side

### 5. **Missing Functionality**
- ❌ CSV Upload not implemented
- ❌ Export not implemented
- ❌ Audit trail not implemented
- ❌ Success/error toast messages inconsistent

---

## 📊 **EXISTING COMPONENTS**

### Tab Components (Child):
1. ✅ `rmsVendorsTable` - Vendors (card-based UI)
2. ✅ `rmsContractsTable` - Contracts (card-based UI)
3. ✅ `rmsRatesTable` - Rate Lookup (table UI, read-only from MV)
4. ✅ `rmsOceanFreight` - Ocean Freight management (table UI)
5. ✅ `rmsSurchargesTable` - Surcharges (table UI)
6. ✅ `rmsMarginRulesCards` - Margin Rules (card-based UI)

### Shared Components:
1. ✅ `rmsManagement` - Parent orchestrator
2. ✅ `rmsModalForm` - Generic modal for CRUD operations
3. ✅ `rmsSchemaConstants` - Field definitions and validation

### Apex Services (Backend):
1. ✅ `RMSVendorService` - Vendor CRUD
2. ✅ `RMSContractService` - Contract CRUD
3. ✅ `OceanFreightRateService` - Ocean Freight CRUD
4. ✅ `SurchargeService` - Surcharge CRUD
5. ✅ `MarginRuleService` - Margin Rule CRUD (needs fixing)
6. ❌ `RMSAuditService` - TO CREATE

### API Endpoints (Node.js/Fastify):
1. ✅ `/api/vendors` - GET, POST, PUT, DELETE
2. ✅ `/api/contracts` - GET, POST, PUT, DELETE
3. ✅ `/api/ocean-freight-rates` - GET, POST, PUT, DELETE
4. ✅ `/api/rates` - GET (materialized view, read-only)
5. ✅ `/api/surcharges` - GET, POST, PUT, DELETE
6. ✅ `/api/margin-rules` - GET, POST, PUT, DELETE
7. ❌ `/api/audit` - TO CREATE

---

## 🎯 **STEP-BY-STEP ACTION PLAN**

### **Phase 1: Foundation (Prerequisites)**

#### Step 1.1: Create Audit Infrastructure ⏱️ 30 min
- [ ] Create `rms_audit_log` table in Supabase
- [ ] Add audit helper function in API (`logAudit()`)
- [ ] Create `RMSAuditService.cls` Apex class
- [ ] Add audit endpoint `/api/audit`

#### Step 1.2: Fix Schema Constants ⏱️ 15 min
- [ ] Review `rmsSchemaConstants.js`
- [ ] Ensure all entities have complete field definitions:
  - `VENDOR_FIELDS`
  - `CONTRACT_FIELDS`
  - `RATE_FIELDS` (already exists)
  - `OCEAN_FREIGHT_FIELDS` (map to RATE_FIELDS or create new)
  - `SURCHARGE_FIELDS`
  - `MARGIN_RULE_FIELDS`

#### Step 1.3: Fix rmsModalForm Component ⏱️ 30 min
- [ ] Ensure entity type mapping works correctly
- [ ] Fix data loading in edit mode
- [ ] Add proper validation
- [ ] Connect save functionality
- [ ] Add success/error toasts

---

### **Phase 2: Tab-by-Tab Implementation**

---

### **TAB 1: VENDORS** ⏱️ 2-3 hours

#### Step 2.1.1: Move Buttons to Component Level
- [ ] Remove Create/Upload/Export from `rmsManagement`
- [ ] Add action bar to `rmsVendorsTable.html`
- [ ] Wire up button handlers in `rmsVendorsTable.js`

#### Step 2.1.2: Fix Create Functionality
- [ ] `handleCreate()` - dispatch event with `entityType: 'vendors'`
- [ ] Parent opens modal with correct schema
- [ ] Modal form renders all vendor fields
- [ ] Save creates vendor via Apex
- [ ] Apex calls API `/api/vendors` POST
- [ ] API logs audit entry
- [ ] Success toast + refresh data
- [ ] Error handling with clear messages

#### Step 2.1.3: Fix Edit Functionality
- [ ] `handleEdit(event)` - extract correct record ID
- [ ] Dispatch event with `entityType: 'vendors'` + `recordId`
- [ ] Parent fetches full record
- [ ] Modal opens with pre-filled data
- [ ] Save updates vendor via Apex
- [ ] Apex calls API `/api/vendors/:id` PUT
- [ ] API logs audit entry with changed fields
- [ ] Success toast + refresh data

#### Step 2.1.4: Fix Delete Functionality
- [ ] `handleDelete(event)` - extract record ID
- [ ] Show confirmation dialog
- [ ] Delete vendor via Apex
- [ ] Apex calls API `/api/vendors/:id` DELETE
- [ ] API logs audit entry
- [ ] Success toast + refresh data

#### Step 2.1.5: Implement CSV Upload
- [ ] Add file input component
- [ ] Parse CSV on client side
- [ ] Validate data format
- [ ] Batch create vendors via Apex
- [ ] Show progress indicator
- [ ] Display success/error summary

#### Step 2.1.6: Implement Export
- [ ] Fetch all vendors (or filtered)
- [ ] Convert to CSV format
- [ ] Trigger browser download
- [ ] Include timestamp in filename

#### Step 2.1.7: Testing
- [ ] Test Create with valid data
- [ ] Test Create with invalid data (error handling)
- [ ] Test Edit existing vendor
- [ ] Test Delete with confirmation
- [ ] Test CSV upload with sample file
- [ ] Test Export functionality
- [ ] Verify audit trail in database

---

### **TAB 2: CONTRACTS** ⏱️ 2-3 hours

#### Step 2.2.1: Move Buttons to Component Level
- [ ] Add action bar to `rmsContractsTable.html`
- [ ] Wire up button handlers in `rmsContractsTable.js`

#### Step 2.2.2: Fix Create Functionality
- [ ] Handle vendor dropdown (required field)
- [ ] Auto-generate contract number on API side
- [ ] Implement all create flow steps (same as vendors)

#### Step 2.2.3: Fix Edit Functionality
- [ ] Load contract with vendor details
- [ ] Allow changing dates, currency, terms
- [ ] Prevent changing vendor (business rule)
- [ ] Implement all edit flow steps

#### Step 2.2.4: Fix Delete Functionality
- [ ] Check for dependent ocean freight rates
- [ ] Warn if rates exist
- [ ] Implement cascade or prevent delete
- [ ] Implement all delete flow steps

#### Step 2.2.5: Implement CSV Upload
- [ ] Parse CSV with vendor ID or name
- [ ] Lookup vendor by name if needed
- [ ] Validate contract dates
- [ ] Batch create

#### Step 2.2.6: Implement Export
- [ ] Include vendor name in export
- [ ] Include contract number
- [ ] Export with proper formatting

#### Step 2.2.7: Testing
- [ ] Full test suite (same as vendors)

---

### **TAB 3: OCEAN FREIGHT** ⏱️ 3-4 hours

#### Step 2.3.1: Move Buttons to Component Level
- [ ] Add action bar to `rmsOceanFreight.html`
- [ ] Wire up button handlers

#### Step 2.3.2: Fix Create Functionality
- [ ] Vendor dropdown → Contract dropdown (cascading)
- [ ] Origin/Destination lookup fields
- [ ] Container type dropdown
- [ ] Buy amount, currency, transit days
- [ ] Date range validation
- [ ] Check unique constraint (contract + origin + dest + container)
- [ ] Implement create flow

#### Step 2.3.3: Fix Edit Functionality
- [ ] Load rate with all details
- [ ] Allow changing buy_amount, tt_days, dates
- [ ] Prevent changing route (contract, origin, dest, container)
- [ ] Implement edit flow

#### Step 2.3.4: Fix Delete Functionality
- [ ] Check if rate is used in quotes (future)
- [ ] Implement delete flow

#### Step 2.3.5: Fix Mark as Preferred
- [ ] Toggle `is_preferred` flag
- [ ] Ensure only one preferred per route
- [ ] Update immediately without modal

#### Step 2.3.6: Implement CSV Upload
- [ ] Parse CSV with contract ID, origin, dest codes
- [ ] Lookup location IDs
- [ ] Validate all constraints
- [ ] Batch create with error reporting

#### Step 2.3.7: Implement Export
- [ ] Include vendor, contract, origin name, dest name
- [ ] Export with all rate details

#### Step 2.3.8: Testing
- [ ] Test all CRUD operations
- [ ] Test unique constraint violations
- [ ] Test preferred flag toggling

---

### **TAB 4: SURCHARGES** ⏱️ 3-4 hours

#### Step 2.4.1: Move Buttons to Component Level
- [ ] Add action bar to `rmsSurchargesTable.html`

#### Step 2.4.2: Fix Create Functionality
- [ ] Vendor dropdown → Contract dropdown
- [ ] Charge code lookup (from charge_master)
- [ ] Applies scope dropdown
- [ ] Location lookup (optional, based on scope)
- [ ] UOM dropdown
- [ ] Calc method dropdown
- [ ] Amount and currency
- [ ] Container type (optional)
- [ ] Date range
- [ ] Implement create flow

#### Step 2.4.3: Fix Edit Functionality
- [ ] Load surcharge with all details
- [ ] Allow changing amount, dates, validity
- [ ] Implement edit flow

#### Step 2.4.4: Fix Delete Functionality
- [ ] Implement delete flow

#### Step 2.4.5: Implement CSV Upload
- [ ] Complex CSV format (many fields)
- [ ] Lookup charge codes
- [ ] Validate enums (scope, UOM, calc_method)
- [ ] Batch create

#### Step 2.4.6: Implement Export
- [ ] Export with all surcharge details

#### Step 2.4.7: Testing
- [ ] Full test suite

---

### **TAB 5: MARGIN RULES** ⏱️ 3-4 hours

#### Step 2.5.1: Move Buttons to Component Level
- [ ] Add action bar to `rmsMarginRulesCards.html`

#### Step 2.5.2: Fix Create Functionality
- [ ] Level dropdown (Global/Trade Zone/Port Pair)
- [ ] Conditional fields based on level:
  - Global: No additional fields
  - Trade Zone: Origin TZ, Dest TZ dropdowns
  - Port Pair: Origin port lookup, Dest port lookup
- [ ] Mark kind dropdown (Percentage/Fixed/Multiplier)
- [ ] Mark value input
- [ ] Component type dropdown
- [ ] Mode dropdown
- [ ] Container type (optional)
- [ ] Date range
- [ ] Priority
- [ ] Implement create flow

#### Step 2.5.3: Fix Edit Functionality
- [ ] Load margin rule
- [ ] Allow changing value, priority, dates
- [ ] Prevent changing level/scope (business rule)
- [ ] Implement edit flow

#### Step 2.5.4: Fix Delete Functionality
- [ ] Implement delete flow

#### Step 2.5.5: Implement CSV Upload
- [ ] Parse CSV with level, codes, values
- [ ] Lookup location IDs for port pairs
- [ ] Validate priority conflicts
- [ ] Batch create

#### Step 2.5.6: Implement Export
- [ ] Export with port names (not IDs)
- [ ] Export with trade zones

#### Step 2.5.7: Testing
- [ ] Full test suite
- [ ] Test priority ordering

---

### **Phase 3: Rate Lookup Tab (Read-Only)** ⏱️ 30 min

#### Step 3.1: Clarify Read-Only Nature
- [ ] Remove or disable Create/Edit/Delete buttons
- [ ] Keep Export functionality
- [ ] Add refresh button
- [ ] Show "This is aggregated data from materialized view" message

---

### **Phase 4: Testing & Polish** ⏱️ 2-3 hours

#### Step 4.1: Integration Testing
- [ ] Test all tabs in sequence
- [ ] Test cross-tab dependencies (vendor → contract → rate)
- [ ] Test error scenarios
- [ ] Test concurrent edits

#### Step 4.2: Audit Trail Verification
- [ ] Query `rms_audit_log` table
- [ ] Verify all operations are logged
- [ ] Verify changed fields tracking
- [ ] Create audit report view (optional)

#### Step 4.3: UX Polish
- [ ] Consistent success messages
- [ ] Consistent error messages
- [ ] Loading spinners
- [ ] Confirmation dialogs
- [ ] Validation messages
- [ ] Field hints/help text

#### Step 4.4: Documentation
- [ ] Update API_DOCUMENTATION_V4.md with audit endpoints
- [ ] Create USER_GUIDE.md for RMS Management UI
- [ ] Document CSV upload format for each entity
- [ ] Document business rules and constraints

---

## 📦 **DELIVERABLES**

### Code Artifacts:
1. ✅ Audit table SQL migration
2. ✅ Updated Apex classes (6 services + audit)
3. ✅ Updated LWC components (6 tabs + modal + parent)
4. ✅ Updated API endpoints (6 entity APIs + audit)
5. ✅ CSV upload templates (5 templates)
6. ✅ Updated schema constants

### Documentation:
1. ✅ Updated API documentation
2. ✅ User guide for RMS Management UI
3. ✅ CSV upload format guide
4. ✅ Audit trail query examples

### Testing:
1. ✅ Test results for all tabs
2. ✅ Audit trail verification
3. ✅ Error handling verification

---

## ⏱️ **TIME ESTIMATES**

| Phase | Task | Estimated Time |
|-------|------|----------------|
| Phase 1 | Foundation | 1-2 hours |
| Phase 2.1 | Vendors | 2-3 hours |
| Phase 2.2 | Contracts | 2-3 hours |
| Phase 2.3 | Ocean Freight | 3-4 hours |
| Phase 2.4 | Surcharges | 3-4 hours |
| Phase 2.5 | Margin Rules | 3-4 hours |
| Phase 3 | Rate Lookup | 30 min |
| Phase 4 | Testing & Polish | 2-3 hours |
| **TOTAL** | | **16-23 hours** |

**Estimated Duration**: 2-3 working days with focused effort

---

## 🚨 **CRITICAL DEPENDENCIES**

### Database:
- ✅ Supabase accessible
- ✅ Tables exist
- ❌ Audit table needs creation
- ✅ Reference tables populated (container types, currencies, charge codes)

### API:
- ✅ Endpoints exist
- ⚠️ Field name mismatches need fixing
- ❌ Audit logging needs implementation
- ✅ VM deployment required after changes

### Salesforce:
- ✅ Apex classes deployed
- ✅ LWC components deployed
- ✅ Named Credential configured
- ✅ User permissions configured

---

## 🔄 **EXECUTION ORDER**

### Day 1 Morning (4 hours):
1. Phase 1: Foundation (audit table, schema fixes)
2. Phase 2.1: Vendors (complete)

### Day 1 Afternoon (4 hours):
3. Phase 2.2: Contracts (complete)
4. Start Phase 2.3: Ocean Freight

### Day 2 Morning (4 hours):
5. Finish Phase 2.3: Ocean Freight
6. Phase 2.4: Surcharges (start)

### Day 2 Afternoon (4 hours):
7. Finish Phase 2.4: Surcharges
8. Phase 2.5: Margin Rules (start)

### Day 3 Morning (4 hours):
9. Finish Phase 2.5: Margin Rules
10. Phase 3: Rate Lookup
11. Phase 4: Testing & Polish

---

## ✅ **SUCCESS CRITERIA**

For each tab, verify:
- [ ] ✅ Create button opens modal with correct form
- [ ] ✅ Form validation works
- [ ] ✅ Save creates record in database
- [ ] ✅ Success toast appears
- [ ] ✅ Data refreshes automatically
- [ ] ✅ Edit button opens modal with pre-filled data
- [ ] ✅ Save updates record in database
- [ ] ✅ Delete button shows confirmation
- [ ] ✅ Delete removes record from database
- [ ] ✅ CSV upload processes file correctly
- [ ] ✅ Export downloads CSV file
- [ ] ✅ Audit entry created for every operation
- [ ] ✅ Error messages are clear and actionable

---

## 🎯 **NEXT STEPS**

**CONFIRM WITH USER:**
1. ✅ Is this plan comprehensive?
2. ✅ Any additional requirements?
3. ✅ Priority order correct? (Vendors → Contracts → Ocean Freight → Surcharges → Margin Rules)
4. ✅ Start with Phase 1 (Foundation)?

**ONCE CONFIRMED, PROCEED WITH:**
- Create audit table SQL script
- Fix schema constants
- Start Tab 1 (Vendors) implementation

---

*Last Updated: 2025-11-19*
*Estimated Completion: 2-3 days*

