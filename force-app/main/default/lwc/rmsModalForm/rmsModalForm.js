import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { 
    VENDOR_FIELDS, 
    CONTRACT_FIELDS, 
    RATE_FIELDS, 
    SURCHARGE_FIELDS, 
    MARGIN_RULE_FIELDS,
    getFieldConfig,
    CONTAINER_TYPES,
    CURRENCY_CODES,
    VENDOR_TYPES,
    CHARGE_CODES,
    APPLIES_SCOPE_OPTIONS,
    UOM_OPTIONS,
    CALC_METHOD_OPTIONS,
    MARGIN_RULE_LEVELS,
    MARK_KIND_OPTIONS
} from 'c/rmsSchemaConstants';

export default class RmsModalForm extends LightningElement {
    @api entityType = ''; // 'vendors', 'contracts', 'rates', 'surcharges', 'marginRules'
    @api mode = ''; // 'create', 'edit', 'view', 'upload'
    @api record = {};
    
    @track formData = {};
    @track loading = false;
    @track fileContent = null;
    @track csvPreview = [];
    _lastRecordId = null;
    
    connectedCallback() {
        console.log('rmsModalForm connectedCallback', { mode: this.mode, entityType: this.entityType, record: this.record });
        this.initializeFormData();
    }
    
    renderedCallback() {
        // Only reinitialize if record ID changed (for edit/view)
        if ((this.mode === 'edit' || this.mode === 'view') && this.record) {
            const currentRecordId = this.record.id;
            if (currentRecordId && currentRecordId !== this._lastRecordId) {
                console.log('rmsModalForm: Record changed, reinitializing', currentRecordId);
                this._lastRecordId = currentRecordId;
                this.initializeFormData();
            }
        }
    }
    
    initializeFormData() {
        console.log('rmsModalForm: initializeFormData called', { 
            mode: this.mode, 
            entityType: this.entityType,
            recordKeys: this.record ? Object.keys(this.record).length : 0,
            record: this.record 
        });
        
        if (this.mode === 'edit' || this.mode === 'view') {
            this.formData = this.record && Object.keys(this.record).length > 0 ? { ...this.record } : {};
            console.log('rmsModalForm: formData set for edit/view', this.formData);
        } else if (this.mode === 'create') {
            this.formData = this.getDefaultFormData();
            console.log('rmsModalForm: formData set for create', this.formData);
        }
    }
    
    getDefaultFormData() {
        const fieldConfigs = this.getFieldConfigs();
        const defaults = {};
        
        for (const fieldName in fieldConfigs) {
            const config = fieldConfigs[fieldName];
            if (config.defaultValue !== undefined) {
                defaults[fieldName] = config.defaultValue;
            } else if (config.type === 'checkbox') {
                defaults[fieldName] = false;
            } else if (config.type === 'number') {
                defaults[fieldName] = null;
            } else {
                defaults[fieldName] = '';
            }
        }
        
        return defaults;
    }
    
    handleInputChange(event) {
        const field = event.target.name || event.target.dataset.field;
        let value;
        
        // Handle different input types
        if (event.target.type === 'checkbox') {
            value = event.target.checked;
        } else if (event.target.type === 'number') {
            value = parseFloat(event.target.value) || null;
        } else if (event.detail && event.detail.value !== undefined) {
            // For lightning components (combobox, dual-listbox)
            value = event.detail.value;
        } else {
            value = event.target.value;
        }
        
        console.log('rmsModalForm: Field changed', { field, value, oldValue: this.formData[field] });
        
        this.formData = {
            ...this.formData,
            [field]: value
        };
        
        console.log('rmsModalForm: Updated formData', this.formData);
    }
    
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && file.type === 'text/csv') {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.fileContent = e.target.result;
                this.parseCSV(this.fileContent);
            };
            reader.readAsText(file);
        } else {
            this.showErrorToast('Invalid file type', 'Please upload a CSV file.');
        }
    }
    
    parseCSV(csvContent) {
        const lines = csvContent.split('\n');
        if (lines.length < 2) {
            this.showErrorToast('Invalid CSV', 'CSV file must have a header row and at least one data row.');
            return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const preview = [];
        
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx] || '';
                });
                preview.push(row);
            }
        }
        
        this.csvPreview = preview;
    }
    
    async handleSave() {
        if (this.mode === 'upload') {
            await this.handleBulkUpload();
            return;
        }
        
        // Validate form
        if (!this.validateForm()) {
            return;
        }
        
        this.loading = true;
        try {
            const saveEvent = new CustomEvent('save', {
                detail: {
                    entityType: this.entityType,
                    mode: this.mode,
                    data: this.formData
                }
            });
            this.dispatchEvent(saveEvent);
        } catch (error) {
            this.showErrorToast('Error', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }
    
    async handleBulkUpload() {
        if (!this.fileContent) {
            this.showErrorToast('No file', 'Please select a CSV file to upload.');
            return;
        }
        
        const lines = this.fileContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const records = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const record = {};
                headers.forEach((header, idx) => {
                    const value = values[idx] || '';
                    // Convert to appropriate types
                    if (['vendor_id', 'contract_id', 'tt_days', 'priority'].includes(header)) {
                        record[header] = value ? parseInt(value) : null;
                    } else if (['buy_amount', 'amount', 'mark_value'].includes(header)) {
                        record[header] = value ? parseFloat(value) : null;
                    } else if (['is_active', 'is_preferred'].includes(header)) {
                        record[header] = value === 'true' || value === '1';
                    } else {
                        record[header] = value;
                    }
                });
                records.push(record);
            }
        }
        
        if (records.length === 0) {
            this.showErrorToast('No data', 'CSV file contains no valid records.');
            return;
        }
        
        this.loading = true;
        try {
            const uploadEvent = new CustomEvent('bulkupload', {
                detail: {
                    entityType: this.entityType,
                    records: records
                }
            });
            this.dispatchEvent(uploadEvent);
        } catch (error) {
            this.showErrorToast('Error', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }
    
    validateForm() {
        const requiredFields = this.getRequiredFields();
        const missing = [];
        
        for (const field of requiredFields) {
            if (!this.formData[field] && this.formData[field] !== false && this.formData[field] !== 0) {
                missing.push(field);
            }
        }
        
        if (missing.length > 0) {
            this.showErrorToast('Missing required fields', `Please fill in: ${missing.join(', ')}`);
            return false;
        }
        
        return true;
    }
    
    getRequiredFields() {
        const fieldConfigs = this.getFieldConfigs();
        const requiredFields = [];
        
        for (const fieldName in fieldConfigs) {
            if (fieldConfigs[fieldName].required) {
                requiredFields.push(fieldName);
            }
        }
        
        return requiredFields;
    }
    
    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
    
    get isViewMode() {
        return this.mode === 'view';
    }
    
    get isUploadMode() {
        return this.mode === 'upload';
    }
    
    get isCreateMode() {
        return this.mode === 'create';
    }
    
    get isEditMode() {
        return this.mode === 'edit';
    }
    
    get formattedFields() {
        if (!this.formData) return [];
        const fieldConfigs = this.getFieldConfigs();
        return Object.keys(this.formData).map(key => {
            const fieldConfig = fieldConfigs[key];
            return {
                key: key,
                label: fieldConfig ? fieldConfig.label : key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: this.formData[key] || '',
                type: fieldConfig ? fieldConfig.type : 'text'
            };
        });
    }
    
    get formFields() {
        const fieldConfigs = this.getFieldConfigs();
        if (!fieldConfigs) return [];
        
        return Object.keys(fieldConfigs).map(fieldName => {
            const config = fieldConfigs[fieldName];
            const fieldType = config.type || 'text';
            return {
                name: fieldName,
                label: config.label,
                type: fieldType,
                required: config.required,
                value: this.formData[fieldName] !== undefined ? this.formData[fieldName] : (config.defaultValue || ''),
                options: config.options || [],
                placeholder: config.placeholder || '',
                maxLength: config.maxLength,
                min: config.min,
                step: config.step,
                readOnly: config.readOnly || false,
                relatedEntity: config.relatedEntity || null,
                isTextField: fieldType === 'text',
                isNumberField: fieldType === 'number',
                isDateField: fieldType === 'date',
                isCheckboxField: fieldType === 'checkbox',
                isPicklistField: fieldType === 'picklist',
                isMultiSelectField: fieldType === 'multiselect',
                isTextareaField: fieldType === 'textarea',
                isLookupField: fieldType === 'lookup',
                isPortLookupField: fieldType === 'portlookup',
                isChargeLookupField: fieldType === 'chargelookup'
            };
        });
    }
    
    getFieldConfigs() {
        const configs = {
            vendors: VENDOR_FIELDS,
            contracts: CONTRACT_FIELDS,
            rates: RATE_FIELDS,
            oceanFreight: RATE_FIELDS, // Ocean Freight uses same fields as rates
            surcharges: SURCHARGE_FIELDS,
            marginRules: MARGIN_RULE_FIELDS
        };
        return configs[this.entityType] || {};
    }
    
    get isUploadDisabled() {
        return this.loading || !this.fileContent;
    }
    
    get isVendorForm() {
        return this.entityType === 'vendors';
    }
    
    get isContractForm() {
        return this.entityType === 'contracts';
    }
    
    get isRateForm() {
        return this.entityType === 'rates';
    }
    
    get isSurchargeForm() {
        return this.entityType === 'surcharges';
    }
    
    get isMarginRuleForm() {
        return this.entityType === 'marginRules';
    }
    
    showErrorToast(title, message) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: 'error'
        }));
    }
}

