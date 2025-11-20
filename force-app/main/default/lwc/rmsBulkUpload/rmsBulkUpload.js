import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import bulkCreateVendors from '@salesforce/apex/RMSVendorService.bulkCreateVendors';
import bulkCreateContracts from '@salesforce/apex/RMSContractService.bulkCreateContracts';

export default class RmsBulkUpload extends LightningElement {
    @track selectedEntity = '';
    @track fileContent = null;
    @track fileName = '';
    @track loading = false;
    @track uploadResults = null;
    @track showResults = false;

    get entityOptions() {
        return [
            { label: '-- Select Entity Type --', value: '' },
            { label: 'Vendors', value: 'vendors' },
            { label: 'Rate Contracts', value: 'contracts' }
            // More entities will be added as bulk create methods become available
        ];
    }

    get isEntitySelected() {
        return this.selectedEntity !== '';
    }

    get uploadDisabled() {
        return !this.selectedEntity || !this.fileContent || this.loading;
    }

    get templateDownloadUrl() {
        // Return the appropriate CSV template based on selected entity
        const templates = {
            vendors: '/resource/csv_template_vendors',
            contracts: '/resource/csv_template_contracts'
        };
        return templates[this.selectedEntity] || '';
    }

    get entityLabel() {
        const option = this.entityOptions.find(opt => opt.value === this.selectedEntity);
        return option ? option.label : '';
    }

    get showDownloadTemplate() {
        return this.selectedEntity && this.templateDownloadUrl;
    }

    handleEntityChange(event) {
        this.selectedEntity = event.detail.value;
        this.fileContent = null;
        this.fileName = '';
        this.uploadResults = null;
        this.showResults = false;
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.endsWith('.csv')) {
                this.showToast('Error', 'Please upload a CSV file', 'error');
                return;
            }

            this.fileName = file.name;
            const reader = new FileReader();
            
            reader.onload = () => {
                this.fileContent = reader.result;
                this.showToast('Success', `File "${this.fileName}" loaded successfully`, 'success');
            };

            reader.onerror = () => {
                this.showToast('Error', 'Failed to read file', 'error');
            };

            reader.readAsText(file);
        }
    }

    handleClearFile() {
        this.fileContent = null;
        this.fileName = '';
        this.uploadResults = null;
        this.showResults = false;
        // Reset file input
        const fileInput = this.template.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.value = '';
        }
    }

    async handleUpload() {
        if (!this.fileContent) {
            this.showToast('Error', 'Please select a file first', 'error');
            return;
        }

        this.loading = true;
        this.uploadResults = null;
        this.showResults = false;

        try {
            // Parse CSV
            const records = this.parseCSV(this.fileContent);
            
            if (records.length === 0) {
                throw new Error('No valid records found in CSV file');
            }

            console.log(`Parsed ${records.length} records from CSV`);

            // Call appropriate bulk create method
            let result;
            switch (this.selectedEntity) {
                case 'vendors':
                    result = await bulkCreateVendors({ vendors: records });
                    break;
                case 'contracts':
                    result = await bulkCreateContracts({ contracts: records });
                    break;
                default:
                    throw new Error('Invalid entity type selected');
            }

            console.log('Upload result:', result);

            // Process results
            this.uploadResults = {
                total: records.length,
                successful: result.successCount || 0,
                failed: result.errorCount || 0,
                errors: result.errors || []
            };
            this.showResults = true;

            if (this.uploadResults.failed === 0) {
                this.showToast(
                    'Success', 
                    `Successfully uploaded ${this.uploadResults.successful} ${this.entityLabel}`, 
                    'success'
                );
            } else {
                this.showToast(
                    'Partial Success', 
                    `${this.uploadResults.successful} succeeded, ${this.uploadResults.failed} failed. See details below.`, 
                    'warning'
                );
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(
                'Error', 
                'Upload failed: ' + (error.body?.message || error.message), 
                'error'
            );
        } finally {
            this.loading = false;
        }
    }

    parseCSV(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV must have at least a header row and one data row');
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const record = {};
            
            headers.forEach((header, index) => {
                const value = values[index] || '';
                // Handle boolean values
                if (value === 'true' || value === 'TRUE' || value === '1') {
                    record[header] = true;
                } else if (value === 'false' || value === 'FALSE' || value === '0') {
                    record[header] = false;
                } else if (value && !isNaN(value)) {
                    // Handle numbers
                    record[header] = parseFloat(value);
                } else {
                    record[header] = value;
                }
            });
            
            records.push(record);
        }

        return records;
    }

    handleDownloadTemplate() {
        // Generate and download CSV template
        const template = this.generateTemplate();
        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.selectedEntity}_template.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    generateTemplate() {
        const templates = {
            vendors: `name,vendor_type,mode,Logo_URL
Maersk Line,OCEAN_CARRIER,OCEAN,
MSC Mediterranean Shipping,OCEAN_CARRIER,OCEAN,
CMA CGM,OCEAN_CARRIER,OCEAN,
DHL Global Forwarding,FREIGHT_FORWARDER,"OCEAN,AIR",
Kuehne + Nagel,FREIGHT_FORWARDER,"OCEAN,AIR,ROAD",
Emirates SkyCargo,AIRLINE,AIR,
DB Schenker,FREIGHT_FORWARDER,"OCEAN,AIR,RAIL,ROAD",

========================================
FIELD DESCRIPTIONS & VALIDATION RULES
========================================

1. name (REQUIRED)
   - Vendor/Carrier company name
   - Max 255 characters
   - Must be unique
   - Examples: "Maersk Line", "DHL Global Forwarding"

2. vendor_type (REQUIRED)
   - Choose ONE of: OCEAN_CARRIER, FREIGHT_FORWARDER, NVOCC, AIRLINE, TRUCKER
   - Case-sensitive, use UPPERCASE
   - OCEAN_CARRIER: Shipping lines (Maersk, MSC, CMA CGM)
   - FREIGHT_FORWARDER: Logistics companies (DHL, Kuehne+Nagel)
   - NVOCC: Non-Vessel Operating Common Carrier
   - AIRLINE: Airlines (Emirates, Lufthansa)
   - TRUCKER: Road transport companies

3. mode (REQUIRED)
   - Transport modes vendor supports
   - Can be single or multiple (comma-separated)
   - Valid values: OCEAN, AIR, RAIL, ROAD
   - Examples: 
     * Single: OCEAN
     * Multiple: "OCEAN,AIR" (use quotes if comma-separated)

4. Logo_URL (OPTIONAL)
   - URL to vendor logo image
   - Leave blank if no logo
   - Example: https://example.com/logos/maersk.png

========================================
TIPS FOR SUCCESSFUL UPLOAD
========================================

✓ Remove these instruction lines before uploading
✓ Keep the header row (first line with column names)
✓ Use exact spelling for vendor_type and mode (case-sensitive)
✓ For multiple modes, wrap in quotes: "OCEAN,AIR"
✓ Dates must be YYYY-MM-DD format
✓ Leave Logo_URL blank if not available (no value after last comma)
✓ Save as CSV (UTF-8) format
✓ Maximum 500 records per upload`,

            contracts: `vendor_id,contract_number,contract_type,effective_from,effective_to,payment_terms,credit_days,currency
1,CNTR-MSK-2025-001,CONTRACT,2025-01-01,2025-12-31,NET_30,30,USD
1,SPOT-MSK-2025-JAN,SPOT,2025-01-01,2025-01-31,PREPAID,0,USD
2,CNTR-MSC-2025-001,CONTRACT,2025-01-01,2025-12-31,NET_60,60,EUR
2,CNTR-MSC-2025-Q1,CONTRACT,2025-01-01,2025-03-31,NET_45,45,USD
3,SPOT-CMA-2025-001,SPOT,2025-01-15,2025-02-15,CASH,0,USD

========================================
FIELD DESCRIPTIONS & VALIDATION RULES
========================================

1. vendor_id (REQUIRED)
   - Vendor ID from the Vendors table
   - Must be numeric (integer)
   - Vendor must exist in system
   - Get vendor IDs from Vendors tab or export
   - Example: 1, 2, 3

2. contract_number (REQUIRED)
   - Unique contract identifier
   - Max 100 characters
   - Suggested format: TYPE-VENDOR-YEAR-NUMBER
   - Examples: 
     * CNTR-MSK-2025-001 (Annual contract)
     * SPOT-MSK-2025-JAN (Spot rate for January)

3. contract_type (REQUIRED)
   - Choose ONE of: CONTRACT, SPOT
   - CONTRACT: Long-term agreement (typically 1 year)
   - SPOT: Short-term pricing (typically 1-3 months)

4. effective_from (REQUIRED)
   - Contract start date
   - Format: YYYY-MM-DD
   - Example: 2025-01-01

5. effective_to (REQUIRED)
   - Contract end date
   - Format: YYYY-MM-DD
   - Must be >= effective_from
   - Example: 2025-12-31

6. payment_terms (REQUIRED)
   - Choose ONE of: NET_30, NET_60, NET_45, PREPAID, CASH, LC
   - NET_30: Payment due in 30 days
   - NET_60: Payment due in 60 days
   - PREPAID: Payment before shipment
   - CASH: Immediate payment
   - LC: Letter of Credit

7. credit_days (REQUIRED)
   - Number of credit days
   - Integer between 0 and 180
   - Should match payment_terms:
     * NET_30 → 30
     * NET_60 → 60
     * PREPAID/CASH → 0
   - Example: 30, 60, 0

8. currency (REQUIRED)
   - ISO 4217 currency code (3 letters)
   - Common values: USD, EUR, GBP, INR, CNY, JPY
   - Must exist in system's currency table
   - Example: USD, EUR

========================================
TIPS FOR SUCCESSFUL UPLOAD
========================================

✓ Remove these instruction lines before uploading
✓ Keep the header row (first line with column names)
✓ Verify vendor_id exists in Vendors table
✓ Use unique contract_number for each contract
✓ Dates must be YYYY-MM-DD format
✓ effective_to must be after effective_from
✓ Match credit_days to payment_terms (e.g., NET_30 = 30 days)
✓ Use uppercase for contract_type, payment_terms
✓ Save as CSV (UTF-8) format
✓ Maximum 500 records per upload

========================================
COMMON ERRORS & SOLUTIONS
========================================

Error: "Vendor ID does not exist"
→ Verify vendor_id is correct, create vendor first

Error: "Duplicate contract_number"
→ Contract numbers must be unique, use different identifier

Error: "Invalid date format"
→ Use YYYY-MM-DD format (e.g., 2025-01-01)

Error: "effective_to must be >= effective_from"
→ End date must be same or after start date`
        };
        return templates[this.selectedEntity] || 'No template available';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}

