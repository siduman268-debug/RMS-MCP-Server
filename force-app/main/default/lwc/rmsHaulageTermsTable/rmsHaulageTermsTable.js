import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listHaulageResponsibilities from '@salesforce/apex/RMSHaulageResponsibilityService.listHaulageResponsibilities';

export default class RmsHaulageTermsTable extends LightningElement {
    @api records = [];
    @track loading = false;
    @track filterCategory = '';
    @track filterStatus = 'true';
    
    connectedCallback() {
        this.handleFetchData();
    }
    
    @api
    async handleFetchData() {
        this.loading = true;
        try {
            const data = await listHaulageResponsibilities({
                termCategory: this.filterCategory || null,
                isActive: this.filterStatus ? (this.filterStatus === 'true') : null
            });
            
            this.records = data || [];
            
            this.dispatchEvent(new CustomEvent('dataload', {
                detail: { data: this.records, entityType: 'haulageTerms' },
                bubbles: true,
                composed: true
            }));
            
            if (this.records.length === 0) {
                this.showToast('Info', 'No haulage terms found', 'info');
            }
        } catch (error) {
            console.error('Error fetching haulage terms:', error);
            this.showToast('Error', 'Failed to fetch haulage terms: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create', {
            detail: { entityType: 'haulageTerms' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageTerms' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleView(event) {
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageTerms' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageTerms' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleUpload() {
        this.dispatchEvent(new CustomEvent('upload', {
            detail: { entityType: 'haulageTerms' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleExport() {
        this.dispatchEvent(new CustomEvent('export', {
            detail: { entityType: 'haulageTerms' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleFilterChange() {
        this.handleFetchData();
    }
    
    handleClearFilters() {
        this.filterCategory = '';
        this.filterStatus = 'true';
        this.handleFetchData();
    }
    
    get categoryOptions() {
        return [
            { label: 'All Categories', value: '' },
            { label: 'Incoterm', value: 'INCOTERM' },
            { label: 'Custom', value: 'CUSTOM' },
            { label: 'Standard', value: 'STANDARD' }
        ];
    }
    
    get statusOptions() {
        return [
            { label: 'All', value: '' },
            { label: 'Active', value: 'true' },
            { label: 'Inactive', value: 'false' }
        ];
    }
    
    get formattedRecords() {
        return this.records.map(record => ({
            ...record,
            isActiveLabel: record.is_active ? 'Active' : 'Inactive',
            isActiveClass: record.is_active ? 'slds-badge slds-theme_success' : 'slds-badge',
            iheIncludeLabel: record.ihe_include_in_quote ? 'Yes' : 'No',
            ihiIncludeLabel: record.ihi_include_in_quote ? 'Yes' : 'No'
        }));
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}

