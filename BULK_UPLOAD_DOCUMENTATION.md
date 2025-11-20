# Bulk Upload System Documentation
**Date**: 2025-11-20  
**Component**: `rmsBulkUpload` LWC  
**Status**: ✅ Production Ready

## Overview

The Bulk Upload system provides a centralized, user-friendly interface for importing multiple records via CSV files. It features drag-and-drop file upload, automatic validation, batch processing, and detailed error reporting.

---

## Features

### Core Functionality
- ✅ **Entity Selection**: Dropdown to choose entity type (Vendors, Contracts)
- ✅ **CSV Template Download**: One-click template generation with example data
- ✅ **Drag-and-Drop Upload**: Modern file upload interface
- ✅ **CSV Parsing**: Automatic type conversion (boolean, number, string)
- ✅ **Batch Processing**: Leverages Apex bulk methods for efficiency
- ✅ **Visual Feedback**: Loading spinner, success/error cards
- ✅ **Error Reporting**: Detailed list of failed records with reasons

### User Experience
- **Step-by-Step Workflow**:
  1. Select entity type
  2. Download CSV template
  3. Upload filled CSV
  4. Review results

- **Validation**:
  - File type validation (must be .csv)
  - Header validation
  - Data validation (delegated to Apex/API)

- **Results Display**:
  - Total records count
  - Successful uploads (green card)
  - Failed uploads (red card)
  - Error details list

---

## Technical Architecture

### Component Structure

```
rmsBulkUpload/
├── rmsBulkUpload.js         # Controller logic
├── rmsBulkUpload.html       # UI template
└── rmsBulkUpload.js-meta.xml # Metadata config
```

### Integration Points

#### Apex Services
Currently integrated:
- `RMSVendorService.bulkCreateVendors`
- `RMSContractService.bulkCreateContracts`

Ready for integration (when bulk methods added):
- `RMSOceanFreightService.bulkCreateOceanFreight`
- `RMSSurchargeService.bulkCreateSurcharges`
- `RMSMarginRuleService.bulkCreateMarginRules`
- `RMSHaulageRouteService.bulkCreateHaulageRoutes`
- `RMSHaulageRateService.bulkCreateHaulageRates`
- `RMSHaulageLegService.bulkCreateHaulageLegs`
- `RMSHaulageResponsibilityService.bulkCreateHaulageResponsibilities`

#### Parent Component
Integrated into `rmsManagement` as a separate tab:
```html
<lightning-tab label="Bulk Upload" value="bulkUpload">
    <c-rms-bulk-upload></c-rms-bulk-upload>
</lightning-tab>
```

---

## CSV Format

### Vendors Template
```csv
name,vendor_type,mode,Logo_URL
Test Vendor,FREIGHT_FORWARDER,OCEAN,
Maersk Line,OCEAN_CARRIER,OCEAN,
DHL Freight,FREIGHT_FORWARDER,AIR,
```

**Field Descriptions**:
- `name`: Vendor name (required, max 255 characters)
- `vendor_type`: Enum (`OCEAN_CARRIER`, `FREIGHT_FORWARDER`, `NVOCC`, `AIRLINE`, `TRUCKER`)
- `mode`: Array of strings (`OCEAN`, `AIR`, `RAIL`, `ROAD`)
- `Logo_URL`: Optional URL to vendor logo

### Rate Contracts Template
```csv
vendor_id,contract_number,contract_type,effective_from,effective_to,payment_terms,credit_days,currency
1,CNTR-2025-001,CONTRACT,2025-01-01,2025-12-31,NET_30,30,USD
1,SPOT-2025-001,SPOT,2025-01-01,2025-01-31,CASH,0,USD
```

**Field Descriptions**:
- `vendor_id`: Foreign key to vendor table (required, integer)
- `contract_number`: Unique contract identifier (required, max 100 characters)
- `contract_type`: Enum (`CONTRACT`, `SPOT`)
- `effective_from`: Date (YYYY-MM-DD format)
- `effective_to`: Date (YYYY-MM-DD format)
- `payment_terms`: Enum (`NET_30`, `NET_60`, `PREPAID`, `CASH`, `LC`)
- `credit_days`: Integer (0-180)
- `currency`: ISO currency code (USD, EUR, INR, etc.)

---

## Code Examples

### CSV Parsing Logic
```javascript
parseCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record = {};
        
        headers.forEach((header, index) => {
            const value = values[index] || '';
            // Type conversion
            if (value === 'true' || value === 'TRUE') record[header] = true;
            else if (value === 'false' || value === 'FALSE') record[header] = false;
            else if (!isNaN(value) && value) record[header] = parseFloat(value);
            else record[header] = value;
        });
        
        records.push(record);
    }

    return records;
}
```

### Upload Flow
```javascript
async handleUpload() {
    // 1. Parse CSV
    const records = this.parseCSV(this.fileContent);
    
    // 2. Call Apex bulk method
    const result = await bulkCreateVendors({ vendors: records });
    
    // 3. Display results
    this.uploadResults = {
        total: records.length,
        successful: result.successCount,
        failed: result.errorCount,
        errors: result.errors
    };
}
```

---

## Extension Guide

### Adding a New Entity Type

**Step 1**: Add Apex bulk method
```apex
// In RMSEntityService.cls
@AuraEnabled
public static BulkOperationResult bulkCreateEntities(List<Map<String, Object>> entities) {
    BulkOperationResult result = new BulkOperationResult();
    // ... bulk insert logic ...
    return result;
}
```

**Step 2**: Import Apex method in LWC
```javascript
import bulkCreateEntities from '@salesforce/apex/RMSEntityService.bulkCreateEntities';
```

**Step 3**: Add to entity options
```javascript
get entityOptions() {
    return [
        // ... existing options ...
        { label: 'My Entity', value: 'myEntity' }
    ];
}
```

**Step 4**: Add switch case
```javascript
switch (this.selectedEntity) {
    // ... existing cases ...
    case 'myEntity':
        result = await bulkCreateEntities({ entities: records });
        break;
}
```

**Step 5**: Add CSV template
```javascript
generateTemplate() {
    const templates = {
        // ... existing templates ...
        myEntity: 'field1,field2,field3\nvalue1,value2,value3'
    };
    return templates[this.selectedEntity];
}
```

---

## Error Handling

### Client-Side Validation
- File type check (must be .csv)
- Minimum 2 lines (header + 1 data row)
- Entity selection required

### Server-Side Validation
- Field type validation (Apex)
- Required field validation (Apex)
- Foreign key validation (Database)
- Business rule validation (Apex/Database)

### Error Response Format
```javascript
{
    successCount: 5,
    errorCount: 2,
    errors: [
        'Row 3: Vendor ID 999 does not exist',
        'Row 7: Invalid date format for effective_from'
    ]
}
```

---

## Future Enhancements

### Planned Features
1. **Multi-Entity Upload**: Upload multiple entity types in one session
2. **CSV Preview**: Show first 10 rows before upload
3. **Field Mapping**: Allow users to map CSV columns to fields
4. **Validation Rules**: Pre-upload validation before hitting server
5. **Upload History**: Track all uploads with user, timestamp, results
6. **Export Results**: Download failed records for correction
7. **Scheduled Uploads**: CRON-style scheduled imports
8. **API Integration**: Direct API upload (bypass Salesforce)

### Entity Coverage
- [ ] Ocean Freight Rates (needs bulk API)
- [ ] Surcharges (needs bulk API)
- [ ] Margin Rules (needs bulk API)
- [ ] Haulage Routes (needs bulk API)
- [ ] Haulage Rates (needs bulk API)
- [ ] Haulage Legs (needs bulk API)
- [ ] Haulage Responsibilities (needs bulk API)

---

## Testing

### Manual Testing Checklist
- [ ] Select entity type (Vendors)
- [ ] Download template
- [ ] Upload valid CSV (all records succeed)
- [ ] Upload invalid CSV (some records fail)
- [ ] Upload non-CSV file (error)
- [ ] Upload empty file (error)
- [ ] Upload CSV with missing headers (error)
- [ ] Upload CSV with extra columns (ignored)
- [ ] Clear file and re-upload
- [ ] Switch entity types

### Sample Test Data

#### Valid Vendors CSV
```csv
name,vendor_type,mode,Logo_URL
Test Vendor 1,OCEAN_CARRIER,OCEAN,
Test Vendor 2,FREIGHT_FORWARDER,AIR,
```

#### Invalid Vendors CSV (for error testing)
```csv
name,vendor_type,mode,Logo_URL
,OCEAN_CARRIER,OCEAN,
Test Vendor,INVALID_TYPE,OCEAN,
```

---

## Performance Considerations

### Batch Size
- Recommended: 50-200 records per upload
- Maximum: 500 records (Salesforce governor limits)
- Large uploads: Consider splitting into multiple files

### Governor Limits
- DML Rows: 10,000 per transaction (Apex)
- SOQL Queries: 100 per transaction (Apex)
- Heap Size: 6MB synchronous, 12MB asynchronous

### Best Practices
- Use bulk Apex methods (not row-by-row)
- Minimize SOQL queries in loops
- Consider @future or Queueable for very large uploads
- Implement retry logic for transient errors

---

## Security

### Data Validation
- All uploads validated server-side
- No SQL injection risk (parameterized queries)
- XSS protection (Salesforce automatic escaping)

### Access Control
- Leverages Salesforce profiles and permission sets
- Respects object-level security (CRUD)
- Respects field-level security (FLS)
- Tenant isolation via RLS in database

### Audit Trail
- All bulk creates logged to `rms_audit_log` table
- Includes: user, timestamp, entity type, record count
- Tracks both successes and failures

---

## Troubleshooting

### Common Issues

**Issue**: "No valid records found in CSV file"
- **Cause**: CSV only has header row, or all data rows are empty
- **Solution**: Ensure CSV has at least one data row

**Issue**: "Unable to find Apex action method"
- **Cause**: Apex bulk method not deployed or not @AuraEnabled
- **Solution**: Deploy Apex class, verify @AuraEnabled annotation

**Issue**: "Upload succeeded but records not visible"
- **Cause**: Tenant filtering, or records created for different user
- **Solution**: Check tenant_id in database, verify user permissions

**Issue**: Partial failures with no error messages
- **Cause**: API returning success:true but not populating errors array
- **Solution**: Check Apex bulk method to ensure proper error collection

---

## Conclusion

The Bulk Upload system provides a solid foundation for CSV-based data imports. It's currently production-ready for Vendors and Contracts, with a clear path to support all remaining RMS entities.

**Status**: ✅ Deployed to Production  
**Next Steps**: Add bulk create methods to remaining Apex services  
**Estimated Effort**: 2-4 hours per entity (Apex + testing)

🚀 Ready for use!

