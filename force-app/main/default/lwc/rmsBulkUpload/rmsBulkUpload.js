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
            vendors: 'name,vendor_type,mode,Logo_URL\nTest Vendor,FREIGHT_FORWARDER,OCEAN,',
            contracts: 'vendor_id,contract_number,contract_type,effective_from,effective_to,payment_terms,credit_days,currency\n1,CNTR-2025-001,CONTRACT,2025-01-01,2025-12-31,NET_30,30,USD'
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

