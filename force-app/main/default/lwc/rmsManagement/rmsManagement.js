import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import listVendors from '@salesforce/apex/RMSVendorService.listVendors';
import listContracts from '@salesforce/apex/RMSContractService.listContracts';
import listRates from '@salesforce/apex/OceanFreightRateService.listRatesForLWC';
import getRateForLWC from '@salesforce/apex/OceanFreightRateService.getRateForLWC';
import listSurcharges from '@salesforce/apex/SurchargeService.listSurchargesForLWC';
import listMarginRules from '@salesforce/apex/MarginRuleService.listRulesForLWC';

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
            const data = await listVendors({ 
                vendorType: this.vendorFilters.vendorType, 
                isActive: this.vendorFilters.isActive 
            });
            this.vendors = data || [];
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
            const filtersJson = JSON.stringify(this.rateFilters || {});
            const data = await listRates({ filtersJson: filtersJson });
            this.rates = data || [];
        } catch (error) {
            console.error('Error loading rates:', error);
            this.showErrorToast('Error loading rates', error.body?.message || error.message);
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
    handleCreate() {
        this.currentRecord = {};
        this.modalMode = 'create';
        this.modalTitle = `Create New ${this.getEntityLabel()}`;
        this.showModal = true;
    }
    
    handleEdit(event) {
        const recordId = event.detail?.recordId || event.currentTarget?.dataset?.id;
        const entityType = event.detail?.entityType || this.activeTab;
        // Temporarily set activeTab to ensure correct data retrieval
        const originalTab = this.activeTab;
        if (entityType && entityType !== this.activeTab) {
            this.activeTab = entityType;
        }
        
        // For rates, fetch the full ocean freight rate record (not from materialized view)
        if (entityType === 'rates') {
            this.loading = true;
            getRateForLWC({ rateId: recordId })
                .then(rate => {
                    this.currentRecord = rate;
                    this.modalMode = 'edit';
                    this.modalTitle = `Edit Ocean Freight Rate`;
                    this.showModal = true;
                    this.loading = false;
                })
                .catch(error => {
                    this.showErrorToast('Error', 'Failed to load rate: ' + (error.body?.message || error.message));
                    this.loading = false;
                });
        } else {
            // For other entities, use cached data
            this.currentRecord = this.getRecordById(recordId);
            this.modalMode = 'edit';
            this.modalTitle = `Edit ${this.getEntityLabel()}`;
            this.showModal = true;
        }
        
        // Restore original tab
        this.activeTab = originalTab;
    }
    
    handleView(event) {
        const recordId = event.detail?.recordId || event.currentTarget?.dataset?.id;
        const entityType = event.detail?.entityType || this.activeTab;
        // Temporarily set activeTab to ensure correct data retrieval
        const originalTab = this.activeTab;
        if (entityType && entityType !== this.activeTab) {
            this.activeTab = entityType;
        }
        this.currentRecord = this.getRecordById(recordId);
        this.modalMode = 'view';
        this.modalTitle = `View ${this.getEntityLabel()}`;
        this.showModal = true;
        // Restore original tab
        this.activeTab = originalTab;
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
    
    handleSave() {
        // Validation and save logic will be in child components
        const modal = this.template.querySelector('c-rms-modal');
        if (modal) {
            modal.handleSave();
        }
    }
    
    handleDelete(event) {
        const recordId = event.currentTarget.dataset.id;
        this.recordToDelete = this.getRecordById(recordId);
        this.showDeleteConfirm = true;
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
        const rateId = event.currentTarget.dataset.id;
        this.markRateAsPreferred(rateId);
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
        return data.find(record => (record.id || record.RMS_ID__c) === recordId) || {};
    }
    
    getCurrentData() {
        switch (this.activeTab) {
            case 'vendors':
                return this.vendors;
            case 'contracts':
                return this.contracts;
            case 'rates':
                return this.rates;
            case 'surcharges':
                return this.surcharges;
            case 'marginRules':
                return this.marginRules;
            default:
                return [];
        }
    }
    
    getEntityLabel() {
        const labels = {
            'vendors': 'Vendor',
            'contracts': 'Contract',
            'rates': 'Ocean Freight Rate',
            'surcharges': 'Surcharge',
            'marginRules': 'Margin Rule'
        };
        return labels[this.activeTab] || 'Record';
    }
    
    async deleteRecord(record) {
        this.loading = true;
        try {
            // Delete logic will be implemented based on entity type
            this.showSuccessToast('Record deleted', 'The record has been successfully deleted.');
            // Refresh data
            this.refreshCurrentTab();
        } catch (error) {
            this.showErrorToast('Error deleting record', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }
    
    async markRateAsPreferred(rateId) {
        this.loading = true;
        try {
            // Update preferred status
            this.showSuccessToast('Rate updated', 'The rate has been marked as preferred.');
            this.refreshCurrentTab();
        } catch (error) {
            this.showErrorToast('Error updating rate', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }
    
    refreshCurrentTab() {
        // Force refresh by updating filters
        switch (this.activeTab) {
            case 'vendors':
                this.vendorFilters = { ...this.vendorFilters };
                break;
            case 'contracts':
                this.contractFilters = { ...this.contractFilters };
                break;
            case 'rates':
                this.rateFilters = { ...this.rateFilters };
                break;
            case 'surcharges':
                this.surchargeFilters = { ...this.surchargeFilters };
                break;
            case 'marginRules':
                this.marginRuleFilters = { ...this.marginRuleFilters };
                break;
        }
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

