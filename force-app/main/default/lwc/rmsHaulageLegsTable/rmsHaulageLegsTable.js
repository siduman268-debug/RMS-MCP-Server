import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listHaulageLegs from '@salesforce/apex/RMSHaulageLegService.listHaulageLegs';

export default class RmsHaulageLegsTable extends LightningElement {
    @api records = [];
    @track loading = false;
    @track filterRoute = '';
    
    connectedCallback() {
        this.handleFetchData();
    }
    
    @api
    async handleFetchData() {
        this.loading = true;
        try {
            const data = await listHaulageLegs({
                routeId: this.filterRoute || null
            });
            
            this.records = data || [];
            
            this.dispatchEvent(new CustomEvent('dataload', {
                detail: { data: this.records, entityType: 'haulageLegs' },
                bubbles: true,
                composed: true
            }));
            
            if (this.records.length === 0) {
                this.showToast('Info', 'No haulage legs found', 'info');
            }
        } catch (error) {
            console.error('Error fetching haulage legs:', error);
            this.showToast('Error', 'Failed to fetch haulage legs: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create', {
            detail: { entityType: 'haulageLegs' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageLegs' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleView(event) {
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageLegs' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageLegs' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleUpload() {
        this.dispatchEvent(new CustomEvent('upload', {
            detail: { entityType: 'haulageLegs' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleExport() {
        this.dispatchEvent(new CustomEvent('export', {
            detail: { entityType: 'haulageLegs' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleFilterChange() {
        this.handleFetchData();
    }
    
    handleClearFilters() {
        this.filterRoute = '';
        this.handleFetchData();
    }
    
    get formattedRecords() {
        return this.records.map(record => ({
            ...record,
            routeCode: record.route?.route_code || 'N/A',
            fromLocationName: record.from_location?.location_name || 'N/A',
            toLocationName: record.to_location?.location_name || 'N/A',
            distanceFormatted: record.distance_km ? `${record.distance_km} km` : 'N/A',
            transitFormatted: record.transit_days ? `${record.transit_days} days` : 'N/A'
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

