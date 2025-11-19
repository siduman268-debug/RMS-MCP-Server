import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listRatesForLWC from '@salesforce/apex/OceanFreightRateService.listRatesForLWC';
import getRateForLWC from '@salesforce/apex/OceanFreightRateService.getRateForLWC';
import createRateForLWC from '@salesforce/apex/OceanFreightRateService.createRateForLWC';
import updateRateForLWC from '@salesforce/apex/OceanFreightRateService.updateRateForLWC';
import deleteRateForLWC from '@salesforce/apex/OceanFreightRateService.deleteRateForLWC';
import markRateAsPreferred from '@salesforce/apex/OceanFreightRateService.markRateAsPreferred';
import listVendors from '@salesforce/apex/RMSVendorService.listVendors';
import listContracts from '@salesforce/apex/RMSContractService.listContracts';
import searchPorts from '@salesforce/apex/RMSPortLookupService.searchPorts';

export default class RmsOceanFreight extends LightningElement {
    @track rates = [];
    @track loading = false;
    
    // Filters
    @track filterVendorId = null;
    @track filterContractId = null;
    @track filterOrigin = null;
    @track filterDestination = null;
    @track filterContainerType = null;
    
    // Lookup displays
    @track vendorDisplay = '';
    @track contractDisplay = '';
    @track originDisplay = '';
    @track destinationDisplay = '';
    
    // Vendor/Contract/Port dropdowns
    @track vendors = [];
    @track contracts = [];
    @track originSearchResults = [];
    @track destinationSearchResults = [];
    @track showOriginDropdown = false;
    @track showDestinationDropdown = false;
    @track originSearchLoading = false;
    @track destinationSearchLoading = false;
    @track originNoResults = false;
    @track destinationNoResults = false;
    
    // Container type options
    get containerTypeOptions() {
        return [
            { label: 'All', value: '' },
            { label: '20GP', value: '20GP' },
            { label: '40GP', value: '40GP' },
            { label: '40HC', value: '40HC' },
            { label: '45HC', value: '45HC' },
            { label: '20RF', value: '20RF' },
            { label: '40RF', value: '40RF' }
        ];
    }
    
    get vendorOptions() {
        return [
            { label: 'All Vendors', value: '' },
            ...this.vendors.map(v => ({
                label: v.name || v.alias || `Vendor ${v.id}`,
                value: String(v.id)
            }))
        ];
    }
    
    get contractOptions() {
        return [
            { label: 'All Contracts', value: '' },
            ...this.contracts.map(c => {
                // Format: "Contract Number - Contract Name (SPOT/CONTRACT)"
                const contractNum = c.contract_number || c.id;
                const contractName = c.name || `Contract ${c.id}`;
                const contractType = c.is_spot ? 'SPOT' : 'CONTRACT';
                const displayLabel = c.contract_number ? 
                    `${c.contract_number} - ${contractName} (${contractType})` : 
                    `${contractName} (${contractType})`;
                
                return {
                    label: displayLabel,
                    value: String(c.id)
                };
            })
        ];
    }
    
    get isContractDisabled() {
        return !this.filterVendorId || this.contracts.length === 0;
    }
    
    connectedCallback() {
        this.loadVendors();
    }
    
    async loadVendors() {
        try {
            const data = await listVendors({ vendorType: null, isActive: null });
            this.vendors = data || [];
        } catch (error) {
            console.error('Error loading vendors:', error);
            this.showErrorToast('Error', 'Failed to load vendors: ' + (error.body?.message || error.message || 'Unknown error'));
        }
    }
    
    handleVendorChange(event) {
        const vendorId = event.detail.value;
        this.filterVendorId = vendorId;
        this.vendorDisplay = event.target.options.find(opt => opt.value === vendorId)?.label || '';
        
        // Load contracts for this vendor
        if (vendorId) {
            this.loadContracts(vendorId);
        } else {
            this.contracts = [];
            this.filterContractId = null;
            this.contractDisplay = '';
        }
    }
    
    async loadContracts(vendorId) {
        try {
            const vendorIdDecimal = parseFloat(vendorId);
            const data = await listContracts({ vendorId: vendorIdDecimal, isActive: null });
            this.contracts = data || [];
        } catch (error) {
            console.error('Error loading contracts:', error);
            this.contracts = [];
            this.showErrorToast('Error', 'Failed to load contracts: ' + (error.body?.message || error.message || 'Unknown error'));
        }
    }
    
    handleContractChange(event) {
        const contractId = event.detail.value;
        this.filterContractId = contractId;
        this.contractDisplay = event.target.options.find(opt => opt.value === contractId)?.label || '';
    }
    
    // Origin/Destination port lookup
    handleOriginInputChange(event) {
        const searchTerm = event.target.value;
        this.originDisplay = searchTerm;
        
        if (searchTerm && searchTerm.length >= 2) {
            this.searchOriginPorts(searchTerm);
        } else {
            this.showOriginDropdown = false;
            this.originSearchResults = [];
            this.filterOrigin = null;
        }
    }
    
    handleDestinationInputChange(event) {
        const searchTerm = event.target.value;
        this.destinationDisplay = searchTerm;
        
        if (searchTerm && searchTerm.length >= 2) {
            this.searchDestinationPorts(searchTerm);
        } else {
            this.showDestinationDropdown = false;
            this.destinationSearchResults = [];
            this.filterDestination = null;
        }
    }
    
    searchOriginPorts(searchTerm) {
        this.originSearchLoading = true;
        this.originNoResults = false;
        this.showOriginDropdown = true;
        
        searchPorts({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                const ports = result || [];
                this.originSearchResults = ports.map(port => {
                    const label = port.label || port.value || '';
                    const codeMatch = label.match(/\(([A-Z]{5})\)/);
                    const code = codeMatch ? codeMatch[1] : (port.value || port.code || '');
                    
                    return {
                        label: label.replace(/\s*\([A-Z]{5}\)\s*$/, ''),
                        code: code,
                        value: port.value || label
                    };
                });
                this.originSearchLoading = false;
                this.originNoResults = this.originSearchResults.length === 0;
            })
            .catch(error => {
                console.error('Error searching origin ports:', error);
                this.originSearchLoading = false;
                this.originNoResults = true;
                this.originSearchResults = [];
            });
    }
    
    searchDestinationPorts(searchTerm) {
        this.destinationSearchLoading = true;
        this.destinationNoResults = false;
        this.showDestinationDropdown = true;
        
        searchPorts({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                const ports = result || [];
                this.destinationSearchResults = ports.map(port => {
                    const label = port.label || port.value || '';
                    const codeMatch = label.match(/\(([A-Z]{5})\)/);
                    const code = codeMatch ? codeMatch[1] : (port.value || port.code || '');
                    
                    return {
                        label: label.replace(/\s*\([A-Z]{5}\)\s*$/, ''),
                        code: code,
                        value: port.value || label
                    };
                });
                this.destinationSearchLoading = false;
                this.destinationNoResults = this.destinationSearchResults.length === 0;
            })
            .catch(error => {
                console.error('Error searching destination ports:', error);
                this.destinationSearchLoading = false;
                this.destinationNoResults = true;
                this.destinationSearchResults = [];
            });
    }
    
    handleOriginFocus() {
        if (this.originSearchResults.length > 0) {
            this.showOriginDropdown = true;
        }
    }
    
    handleDestinationFocus() {
        if (this.destinationSearchResults.length > 0) {
            this.showDestinationDropdown = true;
        }
    }
    
    handleOriginBlur() {
        setTimeout(() => {
            this.showOriginDropdown = false;
        }, 200);
    }
    
    handleDestinationBlur() {
        setTimeout(() => {
            this.showDestinationDropdown = false;
        }, 200);
    }
    
    handleOriginSelect(event) {
        const code = event.currentTarget.dataset.code;
        const label = event.currentTarget.dataset.label;
        
        this.filterOrigin = code;
        this.originDisplay = label || code;
        this.showOriginDropdown = false;
        this.originSearchResults = [];
    }
    
    handleDestinationSelect(event) {
        const code = event.currentTarget.dataset.code;
        const label = event.currentTarget.dataset.label;
        
        this.filterDestination = code;
        this.destinationDisplay = label || code;
        this.showDestinationDropdown = false;
        this.destinationSearchResults = [];
    }
    
    handleVendorChange(event) {
        this.filterVendorId = event.detail.value;
        this.filterContractId = '';
        this.contracts = [];
        
        if (this.filterVendorId) {
            this.loadContracts(this.filterVendorId);
        }
    }
    
    handleContractChange(event) {
        this.filterContractId = event.detail.value;
    }
    
    handleContainerTypeChange(event) {
        this.filterContainerType = event.detail.value;
    }
    
    handleFetchRates() {
        this.loadRates();
    }
    
    @api
    async loadRates() {
        this.loading = true;
        try {
            const filters = {};
            
            // Build filters from current selections
            if (this.filterVendorId) {
                filters.vendor_id = this.filterVendorId;
            }
            
            if (this.filterContractId) {
                filters.contract_id = this.filterContractId;
            }
            
            if (this.filterOrigin) {
                filters.origin = this.filterOrigin;
            }
            
            if (this.filterDestination) {
                filters.destination = this.filterDestination;
            }
            
            if (this.filterContainerType) {
                filters.container_type = this.filterContainerType;
            }
            
            console.log('Loading rates with filters:', filters);
            
            const filtersJson = JSON.stringify(filters);
            const data = await listRatesForLWC({ filtersJson: filtersJson });
            
            console.log('Ocean Freight Rates loaded:', data?.length || 0, 'records');
            this.rates = data || [];
            
            if (this.rates.length > 0) {
                this.showSuccessToast('Success', `Loaded ${this.rates.length} ocean freight rate(s)`);
            } else {
                this.showErrorToast('No Results', 'No ocean freight rates found matching the filters');
            }
        } catch (error) {
            console.error('Error loading ocean freight rates:', error);
            this.rates = [];
            this.showErrorToast('Error', error.body?.message || error.message || 'Failed to load rates');
        } finally {
            this.loading = false;
        }
    }
    
    handleClearFilters() {
        this.filterVendorId = null;
        this.filterContractId = null;
        this.filterOrigin = null;
        this.filterDestination = null;
        this.filterContainerType = null;
        this.vendorDisplay = '';
        this.contractDisplay = '';
        this.originDisplay = '';
        this.destinationDisplay = '';
        this.contracts = [];
        this.originSearchResults = [];
        this.destinationSearchResults = [];
        this.rates = [];
    }
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create', {
            detail: { entityType: 'oceanFreight' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        const button = event.currentTarget || event.target.closest('[data-id]');
        const recordId = button?.dataset?.id;
        
        if (!recordId) {
            console.error('No record ID found', event);
            return;
        }
        
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: recordId, entityType: 'oceanFreight' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleView(event) {
        const button = event.currentTarget || event.target.closest('[data-id]');
        const recordId = button?.dataset?.id;
        
        if (!recordId) {
            console.error('No record ID found', event);
            return;
        }
        
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: recordId, entityType: 'oceanFreight' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        const button = event.currentTarget || event.target.closest('[data-id]');
        const recordId = button?.dataset?.id;
        
        if (!recordId) {
            console.error('No record ID found', event);
            return;
        }
        
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: recordId, entityType: 'oceanFreight' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleMarkPreferred(event) {
        const button = event.currentTarget || event.target.closest('[data-id]');
        const recordId = button?.dataset?.id;
        
        if (!recordId) {
            console.error('No record ID found', event);
            return;
        }
        
        this.dispatchEvent(new CustomEvent('markpreferred', {
            detail: { recordId: recordId },
            bubbles: true,
            composed: true
        }));
    }
    
    get hasRates() {
        return this.rates && this.rates.length > 0;
    }
    
    get formattedRates() {
        if (!this.rates) return [];
        
        return this.rates.map(rate => {
            // Now querying ocean_freight_rate table directly, so buy_amount is the correct field
            const buyAmount = rate.buy_amount || null;
            
            return {
                ...rate,
                displayOrigin: rate.origin_code || '—',
                displayDestination: rate.destination_code || '—',
                displayContainerType: rate.container_type || '—',
                displayCurrency: rate.currency || 'USD',
                displayTransitDays: rate.tt_days || '—',
                displayBuyAmount: buyAmount ? 
                    new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: rate.currency || 'USD'
                    }).format(buyAmount) : '—',
                displayValidFrom: this.formatDate(rate.valid_from),
                displayValidTo: this.formatDate(rate.valid_to)
            };
        });
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (e) {
            return dateString;
        }
    }
    
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
}
