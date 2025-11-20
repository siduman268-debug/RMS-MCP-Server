import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listHaulageRoutes from '@salesforce/apex/RMSHaulageRouteService.listHaulageRoutes';

export default class RmsHaulageRoutesTable extends LightningElement {
    @api records = [];
    
    @track loading = false;
    @track sortedBy;
    @track sortedDirection = 'asc';
    
    // Filter properties
    @track filterFromLocation = '';
    @track filterToLocation = '';
    @track filterMode = '';
    @track filterStatus = 'true';
    
    connectedCallback() {
        this.handleFetchData();
    }
    
    @api
    async handleFetchData() {
        this.loading = true;
        try {
            const data = await listHaulageRoutes({
                fromLocation: this.filterFromLocation || null,
                toLocation: this.filterToLocation || null,
                primaryMode: this.filterMode || null,
                isActive: this.filterStatus ? (this.filterStatus === 'true') : null
            });
            
            this.records = data || [];
            
            // Dispatch data to parent for view/edit/delete operations
            this.dispatchEvent(new CustomEvent('dataload', {
                detail: {
                    data: this.records,
                    entityType: 'haulageRoutes'
                },
                bubbles: true,
                composed: true
            }));
            
            if (this.records.length === 0) {
                this.showToast('Info', 'No haulage routes found', 'info');
            }
        } catch (error) {
            console.error('Error fetching haulage routes:', error);
            this.showToast('Error', 'Failed to fetch haulage routes: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create', {
            detail: { entityType: 'haulageRoutes' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageRoutes' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleView(event) {
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageRoutes' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'haulageRoutes' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleUpload() {
        this.dispatchEvent(new CustomEvent('upload', {
            detail: { entityType: 'haulageRoutes' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleExport() {
        this.dispatchEvent(new CustomEvent('export', {
            detail: { entityType: 'haulageRoutes' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleFilterChange() {
        this.handleFetchData();
    }
    
    handleClearFilters() {
        this.filterFromLocation = '';
        this.filterToLocation = '';
        this.filterMode = '';
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
            fromLocationName: record.from_location?.location_name || 'N/A',
            fromLocationCode: record.from_location?.location_code || '',
            toLocationName: record.to_location?.location_name || 'N/A',
            toLocationCode: record.to_location?.location_code || '',
            isActiveLabel: record.is_active ? 'Active' : 'Inactive',
            isActiveClass: record.is_active ? 'slds-badge slds-theme_success' : 'slds-badge',
            distanceFormatted: record.total_distance_km ? `${record.total_distance_km} km` : 'N/A',
            transitFormatted: record.avg_transit_days ? `${record.avg_transit_days} days` : 'N/A'
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

