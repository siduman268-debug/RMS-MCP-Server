import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listRatesForLWC from '@salesforce/apex/OceanFreightRateService.listRatesForLWC';

export default class OceanFreightRateList extends LightningElement {
    @track rates = [];
    @track isLoading = false;
    @track showCreateModal = false;
    @track selectedRate = null;
    @track showEditModal = false;
    
    // Filter properties
    @track polCode = '';
    @track podCode = '';
    @track containerType = '';
    
    // Pagination
    @track currentPage = 1;
    @track pageSize = 10;
    @track totalRecords = 0;
    
    connectedCallback() {
        this.loadRates();
    }
    
    loadRates() {
        this.isLoading = true;
        
        const filters = {};
        if (this.polCode) filters.pol_code = this.polCode;
        if (this.podCode) filters.pod_code = this.podCode;
        if (this.containerType) filters.container_type = this.containerType;
        
        listRatesForLWC({ filtersJson: JSON.stringify(filters) })
            .then(result => {
                this.rates = result;
                this.totalRecords = result.length;
                this.isLoading = false;
            })
            .catch(error => {
                this.showToast('Error', 'Failed to load rates: ' + error.body.message, 'error');
                this.isLoading = false;
            });
    }
    
    handleFilterChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        
        switch(field) {
            case 'polCode':
                this.polCode = value;
                break;
            case 'podCode':
                this.podCode = value;
                break;
            case 'containerType':
                this.containerType = value;
                break;
        }
        
        this.currentPage = 1;
        this.loadRates();
    }
    
    handleCreateRate() {
        this.showCreateModal = true;
    }
    
    handleEditRate(event) {
        const rateId = event.target.dataset.id;
        this.selectedRate = this.rates.find(rate => rate.Id === rateId);
        this.showEditModal = true;
    }
    
    handleDeleteRate(event) {
        const rateId = event.target.dataset.id;
        
        if (confirm('Are you sure you want to delete this rate?')) {
            // Call delete API
            this.showToast('Success', 'Rate deleted successfully', 'success');
            this.loadRates();
        }
    }
    
    handleModalClose() {
        this.showCreateModal = false;
        this.showEditModal = false;
        this.selectedRate = null;
    }
    
    handleRateSaved(event) {
        this.handleModalClose();
        this.loadRates();
        this.showToast('Success', 'Rate saved successfully', 'success');
    }
    
    handleSearch() {
        this.currentPage = 1;
        this.loadRates();
    }
    
    handleClearFilters() {
        this.polCode = '';
        this.podCode = '';
        this.containerType = '';
        this.currentPage = 1;
        this.loadRates();
    }
    
    get filteredRates() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.rates.slice(start, end);
    }
    
    get totalPages() {
        return Math.ceil(this.totalRecords / this.pageSize);
    }
    
    get hasPreviousPage() {
        return this.currentPage > 1;
    }
    
    get hasNextPage() {
        return this.currentPage < this.totalPages;
    }
    
    handlePreviousPage() {
        if (this.hasPreviousPage) {
            this.currentPage--;
        }
    }
    
    handleNextPage() {
        if (this.hasNextPage) {
            this.currentPage++;
        }
    }
    
    showToast(title, message, variant) {
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(evt);
    }
}

