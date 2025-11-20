import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listHaulageRates from '@salesforce/apex/RMSHaulageRateService.listHaulageRates';

export default class RmsHaulageRatesTable extends LightningElement {
    @api records = [];
    
    @track loading = false;
    @track filterVendor = '';
    @track filterRoute = '';
    @track filterMode = '';
    @track filterContainerType = '';
    @track filterStatus = 'true';
    
    connectedCallback() {
        this.handleFetchData();
    }
    
    @api
    async handleFetchData() {
        this.loading = true;
        try {
            const data = await listHaulageRates({
                vendorId: this.filterVendor || null,
                routeId: this.filterRoute || null,
                transportMode: this.filterMode || null,
                containerType: this.filterContainerType || null,
                isActive: this.filterStatus ? (this.filterStatus === 'true') : null
            });
            
            this.records = data || [];
            
            this.dispatchEvent(new CustomEvent('dataload', {
                detail: {
                    data: this.records,
                    entityType: 'haulageRates'
                },
                bubbles: true,
                composed: true
            }));
            
            if (this.records.length === 0) {
                this.showToast('Info', 'No haulage rates found', 'info');
            }
        } catch (error) {
            console.error('Error fetching haulage rates:', error);
            this.showToast('Error', 'Failed to fetch haulage rates: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create', {
            detail: { entityType: 'haulageRates' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageRates' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleView(event) {
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageRates' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageRates' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleUpload() {
        this.dispatchEvent(new CustomEvent('upload', {
            detail: { entityType: 'haulageRates' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleExport() {
        this.dispatchEvent(new CustomEvent('export', {
            detail: { entityType: 'haulageRates' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleFilterChange() {
        this.handleFetchData();
    }
    
    handleClearFilters() {
        this.filterVendor = '';
        this.filterRoute = '';
        this.filterMode = '';
        this.filterContainerType = '';
        this.filterStatus = 'true';
        this.handleFetchData();
    }
    
    get modeOptions() {
        return [
            { label: 'All Modes', value: '' },
            { label: 'Road', value: 'ROAD' },
            { label: 'Rail', value: 'RAIL' },
            { label: 'Barge', value: 'BARGE' }
        ];
    }
    
    get containerOptions() {
        return [
            { label: 'All Containers', value: '' },
            { label: '20GP', value: '20GP' },
            { label: '40GP', value: '40GP' },
            { label: '40HC', value: '40HC' },
            { label: '45HC', value: '45HC' }
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
            vendorName: record.vendor?.name || 'N/A',
            routeCode: record.route?.route_code || 'N/A',
            rateDisplay: `${record.currency} ${record.rate_per_container || record.flat_rate || 'N/A'}`,
            isActiveLabel: record.is_active ? 'Active' : 'Inactive',
            isActiveClass: record.is_active ? 'slds-badge slds-theme_success' : 'slds-badge'
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

