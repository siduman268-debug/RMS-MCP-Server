import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import listVendors from '@salesforce/apex/RMSVendorService.listVendors';
import createVendor from '@salesforce/apex/RMSVendorService.createVendor';
import updateVendor from '@salesforce/apex/RMSVendorService.updateVendor';
import deleteVendor from '@salesforce/apex/RMSVendorService.deleteVendor';
import listContracts from '@salesforce/apex/RMSContractService.listContracts';
import createContract from '@salesforce/apex/RMSContractService.createContract';
import updateContract from '@salesforce/apex/RMSContractService.updateContract';
import deleteContract from '@salesforce/apex/RMSContractService.deleteContract';
import listAggregatedRates from '@salesforce/apex/OceanFreightRateService.listAggregatedRatesForLWC';
import getRateForLWC from '@salesforce/apex/OceanFreightRateService.getRateForLWC';
import createRateForLWC from '@salesforce/apex/OceanFreightRateService.createRateForLWC';
import updateRateForLWC from '@salesforce/apex/OceanFreightRateService.updateRateForLWC';
import deleteRate from '@salesforce/apex/OceanFreightRateService.deleteRateForLWC';
import markRateAsPreferred from '@salesforce/apex/OceanFreightRateService.markRateAsPreferred';
import listSurcharges from '@salesforce/apex/SurchargeService.listSurchargesForLWC';
import createSurcharge from '@salesforce/apex/RMSSurchargeService.createSurcharge';
import updateSurcharge from '@salesforce/apex/RMSSurchargeService.updateSurcharge';
import deleteSurcharge from '@salesforce/apex/RMSSurchargeService.deleteSurcharge';
import listMarginRules from '@salesforce/apex/MarginRuleService.listRulesForLWC';
import createMarginRule from '@salesforce/apex/RMSMarginRuleService.createMarginRule';
import updateMarginRule from '@salesforce/apex/RMSMarginRuleService.updateMarginRule';
import deleteMarginRule from '@salesforce/apex/RMSMarginRuleService.deleteMarginRule';

export default class RmsManagement extends NavigationMixin(LightningElement) {
    @track activeTab = 'vendors';
    @track vendors = [];
    @track contracts = [];
    @track rates = [];
    @track surcharges = [];
    @track marginRules = [];
    
    @track showModal = false;
    @track modalTitle = '';
    @track modalMode = ''; // 'create', 'edit', 'view', 'upload'
    @track currentRecord = {};
    @track loading = false;
    
    @track selectedRecords = [];
    @track showDeleteConfirm = false;
    @track recordToDelete = null;
    
    // Filters
    @track vendorFilters = { vendorType: null, isActive: true };
    @track contractFilters = { vendorId: null, isActive: true };
    @track rateFilters = {};
    @track surchargeFilters = {};
    @track marginRuleFilters = {};
    
    connectedCallback() {
        this.loadData();
    }
    
    async loadData() {
        this.loading = true;
        try {
            await Promise.all([
                this.loadVendors(),
                this.loadContracts(),
                this.loadRates(),
                this.loadSurcharges(),
                this.loadMarginRules()
            ]);
        } catch (error) {
            this.showErrorToast('Error loading data', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }
    
    async loadVendors() {
        try {
            console.log('loadVendors called, fetching from API...');
            const data = await listVendors({ 
                vendorType: this.vendorFilters.vendorType, 
                isActive: this.vendorFilters.isActive 
            });
            // Force new array reference for reactivity
            this.vendors = [...(data || [])];
            console.log('loadVendors completed, vendor count:', this.vendors.length);
        } catch (error) {
            console.error('Error loading vendors:', error);
            this.showErrorToast('Error loading vendors', error.body?.message || error.message);
        }
    }
    
    async loadContracts() {
        try {
            const data = await listContracts({ 
                vendorId: this.contractFilters.vendorId, 
                isActive: this.contractFilters.isActive 
            });
            this.contracts = data || [];
        } catch (error) {
            console.error('Error loading contracts:', error);
            this.showErrorToast('Error loading contracts', error.body?.message || error.message);
        }
    }
    
    async loadRates() {
        try {
            this.loading = true;
            console.log('Loading aggregated rates (from MV) with filters:', this.rateFilters);
            const filtersJson = JSON.stringify(this.rateFilters || {});
            const data = await listAggregatedRates({ filtersJson: filtersJson });
            console.log('Aggregated rates loaded:', data?.length || 0, 'records');
            this.rates = data || [];
            this.loading = false;
        } catch (error) {
            console.error('Error loading aggregated rates:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            this.rates = [];
            this.loading = false;
            this.showErrorToast('Error loading rates', error.body?.message || error.message || 'Unknown error');
        }
    }
    
    handleRateFilterChange(event) {
        this.rateFilters = event.detail.filters || {};
        this.loadRates();
    }
    
    async loadSurcharges() {
        try {
            const filtersJson = JSON.stringify(this.surchargeFilters || {});
            const data = await listSurcharges({ filtersJson: filtersJson });
            this.surcharges = data || [];
        } catch (error) {
            console.error('Error loading surcharges:', error);
            this.showErrorToast('Error loading surcharges', error.body?.message || error.message);
        }
    }
    
    async loadMarginRules() {
        try {
            const filtersJson = JSON.stringify(this.marginRuleFilters || {});
            const data = await listMarginRules({ filtersJson: filtersJson });
            this.marginRules = data || [];
        } catch (error) {
            console.error('Error loading margin rules:', error);
            this.showErrorToast('Error loading margin rules', error.body?.message || error.message);
        }
    }
    
    // Tab handling
    handleTabChange(event) {
        this.activeTab = event.detail.value;
        this.selectedRecords = [];
    }
    
    // Modal handlers
    handleCreate(event) {
        // Get entity type from event detail if provided (from child component)
        const entityType = event?.detail?.entityType || this.activeTab;
        
        // Temporarily set activeTab to ensure correct form is shown
        const originalTab = this.activeTab;
        if (entityType && entityType !== this.activeTab) {
            this.activeTab = entityType;
        }
        
        this.currentRecord = {};
        this.modalMode = 'create';
        this.modalTitle = `Create New ${this.getEntityLabel()}`;
        this.showModal = true;
        
        // Restore original tab after modal opens
        this.activeTab = originalTab;
    }
    
    handleEdit(event) {
        try {
            // Extract recordId from multiple possible sources
            let recordId = null;
            let entityType = this.activeTab;
            
            // Check event.detail first (from CustomEvent)
            if (event?.detail?.recordId) {
                recordId = event.detail.recordId;
                entityType = event.detail.entityType || entityType;
            }
            // Check event.currentTarget.dataset.id (direct button click)
            else if (event?.currentTarget?.dataset?.id) {
                recordId = event.currentTarget.dataset.id;
            }
            // Check event.target.closest (button icon click)
            else if (event?.target) {
                const button = event.target.closest('[data-id]');
                if (button) {
                    recordId = button.dataset.id;
                }
            }
            
            if (!recordId) {
                console.error('No record ID found', event);
                console.error('Event structure:', JSON.stringify(event, Object.getOwnPropertyNames(event)));
                this.showErrorToast('Error', 'Record ID is missing');
                return;
            }
            
            console.log('handleEdit called', { recordId, entityType, activeTab: this.activeTab, eventDetail: event?.detail });
            
            // Temporarily set activeTab to ensure correct data retrieval
            const originalTab = this.activeTab;
            if (entityType && entityType !== this.activeTab) {
                this.activeTab = entityType;
            }
            
            // For rates and oceanFreight, fetch full record for editing
            if (entityType === 'rates' || entityType === 'oceanFreight') {
                // Try to get from cached data first
                const cachedRecord = this.getRecordById(recordId);
                console.log('Cached record for edit:', cachedRecord);
                
                // Always fetch from server for edit (need full record with all fields)
                this.loading = true;
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
                );
                
                Promise.race([
                    getRateForLWC({ rateId: recordId }),
                    timeoutPromise
                ])
                .then(rate => {
                    console.log('Rate loaded:', rate);
                    if (rate && Object.keys(rate).length > 0) {
                        this.currentRecord = rate;
                        this.modalMode = 'edit';
                        this.modalTitle = entityType === 'oceanFreight' ? `Edit Ocean Freight Rate` : `Edit ${this.getEntityLabel()}`;
                        this.showModal = true;
                        this.loading = false;
                        this.activeTab = originalTab;
                    } else {
                        throw new Error('Rate data is empty');
                    }
                })
                .catch(error => {
                    console.error('Error loading rate:', error);
                    // If fetch fails but we have cached data, use it
                    if (cachedRecord && Object.keys(cachedRecord).length > 0) {
                        console.log('Using cached record as fallback');
                        this.currentRecord = cachedRecord;
                        this.modalMode = 'edit';
                        this.modalTitle = entityType === 'oceanFreight' ? `Edit Ocean Freight Rate` : `Edit ${this.getEntityLabel()}`;
                        this.showModal = true;
                        this.showErrorToast('Warning', 'Could not load full record details. Using cached data. ' + (error.body?.message || error.message || ''));
                    } else {
                        this.showErrorToast('Error', 'Failed to load rate: ' + (error.body?.message || error.message || 'Unknown error'));
                    }
                    this.loading = false;
                    this.activeTab = originalTab;
                });
            } else {
                // For other entities, use cached data
                this.currentRecord = this.getRecordById(recordId);
                this.modalMode = 'edit';
                this.modalTitle = `Edit ${this.getEntityLabel()}`;
                this.showModal = true;
                this.activeTab = originalTab;
            }
        } catch (error) {
            console.error('Error in handleEdit:', error);
            this.showErrorToast('Error', 'Failed to edit record: ' + (error.message || 'Unknown error'));
            this.loading = false;
        }
    }
    
    handleView(event) {
        try {
            // Extract recordId from multiple possible sources
            let recordId = null;
            let entityType = this.activeTab;
            
            // Check event.detail first (from CustomEvent)
            if (event?.detail?.recordId) {
                recordId = event.detail.recordId;
                entityType = event.detail.entityType || entityType;
            }
            // Check event.currentTarget.dataset.id (direct button click)
            else if (event?.currentTarget?.dataset?.id) {
                recordId = event.currentTarget.dataset.id;
            }
            // Check event.target.closest (button icon click)
            else if (event?.target) {
                const button = event.target.closest('[data-id]');
                if (button) {
                    recordId = button.dataset.id;
                }
            }
            
            if (!recordId) {
                console.error('No record ID found', event);
                console.error('Event structure:', JSON.stringify(event, Object.getOwnPropertyNames(event)));
                this.showErrorToast('Error', 'Record ID is missing');
                return;
            }
            
            console.log('handleView called', { recordId, entityType, activeTab: this.activeTab, eventDetail: event?.detail });
            
            // Temporarily set activeTab to ensure correct data retrieval
            const originalTab = this.activeTab;
            if (entityType && entityType !== this.activeTab) {
                this.activeTab = entityType;
            }
            
            // For rates and oceanFreight, use cached data from table (view doesn't need full record)
            if (entityType === 'rates' || entityType === 'oceanFreight') {
                const cachedRecord = this.getRecordById(recordId);
                this.currentRecord = cachedRecord || {};
                this.modalMode = 'view';
                this.modalTitle = `View Ocean Freight Rate`;
                this.showModal = true;
                this.activeTab = originalTab;
            } else {
                // For other entities, use cached data
                this.currentRecord = this.getRecordById(recordId);
                this.modalMode = 'view';
                this.modalTitle = `View ${this.getEntityLabel()}`;
                this.showModal = true;
                this.activeTab = originalTab;
            }
        } catch (error) {
            console.error('Error in handleView:', error);
            this.showErrorToast('Error', 'Failed to view record: ' + (error.message || 'Unknown error'));
            this.loading = false;
        }
    }
    
    handleUpload() {
        this.modalMode = 'upload';
        this.modalTitle = `Bulk Upload ${this.getEntityLabel()}`;
        this.currentRecord = {};
        this.showModal = true;
    }
    
    handleCloseModal() {
        this.showModal = false;
        this.currentRecord = {};
        this.modalMode = '';
    }
    
    handleSave(event) {
        // Get save event details from modal form
        const { entityType, mode, data } = event.detail || {};
        
        if (!data) {
            // Try to get from modal component directly
            const modal = this.template.querySelector('c-rms-modal-form');
            if (modal) {
                modal.handleSave();
            }
            return;
        }
        
        // Handle save based on entity type
        this.saveRecord(entityType, mode, data);
    }
    
    async saveRecord(entityType, mode, data) {
        this.loading = true;
        try {
            console.log('saveRecord called', { entityType, mode, data });
            
            let result;
            const entityLabel = this.getEntityLabel(entityType);
            
            // Handle different entity types
            if (entityType === 'vendors') {
                // Transform mode from array to proper format if needed
                if (data.mode && Array.isArray(data.mode)) {
                    // Mode is already an array, keep it
                } else if (data.mode && typeof data.mode === 'string') {
                    // Convert comma-separated string to array
                    data.mode = data.mode.split(',').map(m => m.trim());
                } else if (!data.mode) {
                    // Default to empty array if no mode
                    data.mode = [];
                }
                
                console.log('Vendor data after transformation:', data);
                
                if (mode === 'create') {
                    result = await createVendor({ vendorData: data });
                    this.showSuccessToast('Vendor created', `${data.name || 'Vendor'} has been created successfully.`);
                } else if (mode === 'edit') {
                    const vendorId = data.id;
                    // Remove fields that shouldn't be updated
                    delete data.id;
                    delete data.tenant_id;
                    delete data.Logo_URL;
                    
                    console.log('Updating vendor with data:', data);
                    result = await updateVendor({ vendorId: vendorId, updates: data });
                    this.showSuccessToast('Vendor updated', `${data.name || 'Vendor'} has been updated successfully.`);
                }
            } else if (entityType === 'contracts') {
                if (mode === 'create') {
                    result = await createContract({ contractData: data });
                    this.showSuccessToast('Contract created', 'Contract has been created successfully.');
                } else if (mode === 'edit') {
                    const contractId = data.id;
                    delete data.id;
                    result = await updateContract({ contractId: contractId, updates: data });
                    this.showSuccessToast('Contract updated', 'Contract has been updated successfully.');
                }
            } else if (entityType === 'rates' || entityType === 'oceanFreight') {
                if (mode === 'create') {
                    result = await createRateForLWC({ rateData: data });
                    this.showSuccessToast('Rate created', 'Ocean freight rate has been created successfully.');
                } else if (mode === 'edit') {
                    const rateId = data.id || data.rate_id;
                    delete data.id;
                    delete data.rate_id;
                    result = await updateRateForLWC({ rateId: rateId, updates: data });
                    this.showSuccessToast('Rate updated', 'Ocean freight rate has been updated successfully.');
                }
            } else if (entityType === 'surcharges') {
                if (mode === 'create') {
                    result = await createSurcharge({ surchargeData: data });
                    this.showSuccessToast('Surcharge created', 'Surcharge has been created successfully.');
                } else if (mode === 'edit') {
                    const surchargeId = data.id;
                    delete data.id;
                    result = await updateSurcharge({ surchargeId: surchargeId, updates: data });
                    this.showSuccessToast('Surcharge updated', 'Surcharge has been updated successfully.');
                }
            } else if (entityType === 'marginRules') {
                if (mode === 'create') {
                    result = await createMarginRule({ ruleData: data });
                    this.showSuccessToast('Margin rule created', 'Margin rule has been created successfully.');
                } else if (mode === 'edit') {
                    const ruleId = data.id;
                    delete data.id;
                    result = await updateMarginRule({ ruleId: ruleId, updates: data });
                    this.showSuccessToast('Margin rule updated', 'Margin rule has been updated successfully.');
                }
            } else {
                throw new Error(`Unsupported entity type: ${entityType}`);
            }
            
            console.log('Save result:', result);
            
            // Close modal and refresh data
            this.showModal = false;
            this.currentRecord = {};
            this.modalMode = '';
            await this.refreshCurrentTab();
            
        } catch (error) {
            console.error('Error saving record:', error);
            this.showErrorToast('Error saving', error.body?.message || error.message || 'Failed to save record');
        } finally {
            this.loading = false;
        }
    }
    
    handleSaveSuccess() {
        // Called when save is successful (for modal form callback)
        this.showModal = false;
        this.currentRecord = {};
        this.modalMode = '';
        this.refreshCurrentTab();
    }
    
    handleDelete(event) {
        // Handle both direct button clicks and events from child components
        const recordId = event.detail?.recordId || event.currentTarget?.dataset?.id;
        if (recordId) {
            this.recordToDelete = this.getRecordById(recordId);
            this.showDeleteConfirm = true;
        }
    }
    
    handleDeleteConfirm() {
        if (this.recordToDelete) {
            this.deleteRecord(this.recordToDelete);
        }
        this.showDeleteConfirm = false;
        this.recordToDelete = null;
    }
    
    handleDeleteCancel() {
        this.showDeleteConfirm = false;
        this.recordToDelete = null;
    }
    
    handleBulkDelete() {
        if (this.selectedRecords.length === 0) {
            this.showWarningToast('No records selected', 'Please select at least one record to delete.');
            return;
        }
        
        this.showDeleteConfirm = true;
    }
    
    handleBulkDeleteConfirm() {
        // Bulk delete will be implemented
        this.showDeleteConfirm = false;
        this.selectedRecords = [];
    }
    
    handleExport() {
        const data = this.getCurrentData();
        this.exportToCSV(data, `${this.activeTab}_export_${new Date().toISOString().split('T')[0]}.csv`);
    }
    
    handleMarkPreferred(event) {
        // Handle both direct button clicks and events from child components
        const rateId = event.detail?.recordId || event.currentTarget?.dataset?.id;
        if (rateId) {
            this.markRateAsPreferred(rateId);
        }
    }
    
    // Selection handlers
    handleSelectAll(event) {
        const checked = event.target.checked;
        const data = this.getCurrentData();
        if (checked) {
            this.selectedRecords = data.map(record => record.id || record.RMS_ID__c);
        } else {
            this.selectedRecords = [];
        }
    }
    
    handleSelectRecord(event) {
        const recordId = event.currentTarget.value;
        const checked = event.target.checked;
        
        if (checked) {
            if (!this.selectedRecords.includes(recordId)) {
                this.selectedRecords = [...this.selectedRecords, recordId];
            }
        } else {
            this.selectedRecords = this.selectedRecords.filter(id => id !== recordId);
        }
    }
    
    // Helper methods
    getRecordById(recordId) {
        const data = this.getCurrentData();
        console.log('getRecordById searching for:', recordId, 'in', data?.length, 'records');
        
        // Convert recordId to string and number for comparison
        const recordIdStr = String(recordId);
        const recordIdNum = Number(recordId);
        
        // Check multiple possible ID field names and types
        const found = data.find(record => {
            const id = record.id;
            const idStr = String(id);
            const idNum = Number(id);
            
            return (
                (id === recordId) || 
                (id === recordIdStr) ||
                (id === recordIdNum) ||
                (idStr === recordIdStr) ||
                (idNum === recordIdNum) ||
                (record.rate_id === recordId) || 
                (record.RMS_ID__c === recordId) ||
                (record.vendor_id === recordId) ||
                (record.contract_id === recordId)
            );
        });
        
        console.log('getRecordById found:', found);
        return found || {};
    }
    
    getCurrentData() {
        switch (this.activeTab) {
            case 'vendors':
                return this.vendors;
            case 'contracts':
                return this.contracts;
            case 'rates':
                return this.rates;
            case 'oceanFreight':
                return this.rates; // Uses same data source
            case 'surcharges':
                return this.surcharges;
            case 'marginRules':
                return this.marginRules;
            default:
                return [];
        }
    }
    
    getEntityLabel(entityType) {
        const type = entityType || this.activeTab;
        const labels = {
            'vendors': 'Vendor',
            'contracts': 'Contract',
            'rates': 'Ocean Freight Rate',
            'oceanFreight': 'Ocean Freight Rate',
            'surcharges': 'Surcharge',
            'marginRules': 'Margin Rule'
        };
        return labels[type] || 'Record';
    }
    
    async deleteRecord(record) {
        this.loading = true;
        try {
            console.log('deleteRecord called', { record, activeTab: this.activeTab });
            
            const recordId = record.id || record.rate_id || record.vendor_id || record.contract_id;
            if (!recordId) {
                throw new Error('Record ID is missing');
            }
            
            let result;
            const entityLabel = this.getEntityLabel();
            
            // Handle different entity types
            if (this.activeTab === 'vendors') {
                result = await deleteVendor({ vendorId: recordId });
                if (result === false) {
                    throw new Error('Delete operation returned false - vendor may not exist or access denied');
                }
                this.showSuccessToast('Vendor deleted', `${record.name || 'Vendor'} has been deleted successfully.`);
            } else if (this.activeTab === 'contracts') {
                result = await deleteContract({ contractId: recordId });
                this.showSuccessToast('Contract deleted', 'Contract has been deleted successfully.');
            } else if (this.activeTab === 'rates' || this.activeTab === 'oceanFreight') {
                result = await deleteRate({ rateId: recordId });
                this.showSuccessToast('Rate deleted', 'Ocean freight rate has been deleted successfully.');
            } else if (this.activeTab === 'surcharges') {
                result = await deleteSurcharge({ surchargeId: recordId });
                this.showSuccessToast('Surcharge deleted', 'Surcharge has been deleted successfully.');
            } else if (this.activeTab === 'marginRules') {
                result = await deleteMarginRule({ ruleId: recordId });
                this.showSuccessToast('Margin rule deleted', 'Margin rule has been deleted successfully.');
            } else {
                throw new Error(`Delete not supported for entity type: ${this.activeTab}`);
            }
            
            console.log('Delete result:', result);
            
            // Refresh data
            await this.refreshCurrentTab();
            
        } catch (error) {
            console.error('Error deleting record:', error);
            this.showErrorToast('Error deleting record', error.body?.message || error.message || 'Failed to delete record');
        } finally {
            this.loading = false;
        }
    }
    
    async markRateAsPreferred(rateId) {
        this.loading = true;
        try {
            // Get current preferred status and toggle it
            const rate = this.getRecordById(rateId);
            const currentPreferred = rate.is_preferred || false;
            const newPreferred = !currentPreferred;
            
            // Call Apex to update preferred status
            const result = await markRateAsPreferred({ rateId: rateId, isPreferred: newPreferred });
            
            this.showSuccessToast(
                'Rate updated', 
                `The rate has been ${newPreferred ? 'marked as preferred' : 'unmarked as preferred'}.`
            );
            this.refreshCurrentTab();
        } catch (error) {
            this.showErrorToast('Error updating rate', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }
    
    async refreshCurrentTab() {
        console.log('refreshCurrentTab called for:', this.activeTab);
        // Actually reload data from server
        switch (this.activeTab) {
            case 'vendors':
                await this.loadVendors();
                break;
            case 'contracts':
                await this.loadContracts();
                break;
            case 'rates':
                await this.loadRates();
                break;
            case 'oceanFreight':
                // Trigger refresh in ocean freight component
                const oceanFreightComponent = this.template.querySelector('c-rms-ocean-freight');
                if (oceanFreightComponent) {
                    await oceanFreightComponent.loadRates();
                }
                break;
            case 'surcharges':
                await this.loadSurcharges();
                break;
            case 'marginRules':
                await this.loadMarginRules();
                break;
        }
        console.log('refreshCurrentTab completed');
    }
    
    exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            this.showWarningToast('No data to export', 'There are no records to export.');
            return;
        }
        
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                return value !== null && value !== undefined ? `"${String(value).replace(/"/g, '""')}"` : '';
            }).join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showSuccessToast('Export completed', `Exported ${data.length} records to ${filename}`);
    }
    
    // Toast methods
    showSuccessToast(title, message) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: 'success'
        }));
    }
    
    showErrorToast(title, message) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: 'error'
        }));
    }
    
    showWarningToast(title, message) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: 'warning'
        }));
    }
    
    // Computed properties for UI
    get hasSelectedRecords() {
        return this.selectedRecords.length > 0;
    }
    
    get selectedCount() {
        return this.selectedRecords.length;
    }
}

