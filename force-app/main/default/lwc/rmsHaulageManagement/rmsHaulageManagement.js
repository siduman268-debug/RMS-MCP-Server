import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class RmsHaulageManagement extends LightningElement {
    @track activeSubTab = 'routes';
    @track loading = false;
    
    // Data stores for each sub-tab
    @track routes = [];
    @track rates = [];
    @track legs = [];
    @track terms = [];
    
    handleSubTabChange(event) {
        this.activeSubTab = event.target.value;
        console.log('Haulage sub-tab changed to:', this.activeSubTab);
    }
    
    // Handle events from child components
    handleCreate(event) {
        const { entityType } = event.detail;
        console.log('Create event received for:', entityType);
        // Bubble up to parent rmsManagement
        this.dispatchEvent(new CustomEvent('create', {
            detail: { entityType },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        console.log('Edit event received:', event.detail);
        this.dispatchEvent(new CustomEvent('edit', {
            detail: event.detail,
            bubbles: true,
            composed: true
        }));
    }
    
    handleView(event) {
        console.log('View event received:', event.detail);
        this.dispatchEvent(new CustomEvent('view', {
            detail: event.detail,
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        console.log('Delete event received:', event.detail);
        this.dispatchEvent(new CustomEvent('delete', {
            detail: event.detail,
            bubbles: true,
            composed: true
        }));
    }
    
    handleUpload(event) {
        console.log('Upload event received:', event.detail);
        this.dispatchEvent(new CustomEvent('upload', {
            detail: event.detail,
            bubbles: true,
            composed: true
        }));
    }
    
    handleExport(event) {
        console.log('Export event received:', event.detail);
        this.dispatchEvent(new CustomEvent('export', {
            detail: event.detail,
            bubbles: true,
            composed: true
        }));
    }
    
    handleDataLoad(event) {
        const { data, entityType } = event.detail;
        console.log('Data loaded from child:', entityType, data?.length);
        
        if (entityType === 'haulageRoutes') {
            this.routes = [...(data || [])];
        } else if (entityType === 'haulageRates') {
            this.rates = [...(data || [])];
        } else if (entityType === 'haulageLegs') {
            this.legs = [...(data || [])];
        } else if (entityType === 'haulageTerms') {
            this.terms = [...(data || [])];
        }
        
        // Bubble up to parent
        this.dispatchEvent(new CustomEvent('dataload', {
            detail: { data, entityType },
            bubbles: true,
            composed: true
        }));
    }
    
    // Public API for parent to refresh active sub-tab
    async refreshActiveTab() {
        const activeComponent = this.getActiveChildComponent();
        if (activeComponent && typeof activeComponent.handleFetchData === 'function') {
            await activeComponent.handleFetchData();
        }
    }
    
    getActiveChildComponent() {
        switch (this.activeSubTab) {
            case 'routes':
                return this.template.querySelector('c-rms-haulage-routes-table');
            case 'rates':
                return this.template.querySelector('c-rms-haulage-rates-table');
            case 'legs':
                return this.template.querySelector('c-rms-haulage-legs-table');
            case 'terms':
                return this.template.querySelector('c-rms-haulage-terms-table');
            default:
                return null;
        }
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

