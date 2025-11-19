import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listVendors from '@salesforce/apex/RMSVendorService.listVendors';
import listContracts from '@salesforce/apex/RMSContractService.listContracts';
import listSurcharges from '@salesforce/apex/RMSSurchargeService.listSurcharges';
import searchPorts from '@salesforce/apex/RMSPortLookupService.searchPorts';

export default class RmsSurchargesTable extends LightningElement {
    @api records = [];
    @api selectedRecords = [];
    
    @track loading = false;
    @track surcharges = [];
    
    // Filter properties
    @track filterVendorId = '';
    @track filterContractId = '';
    @track filterPolCode = '';
    @track filterPodCode = '';
    @track filterContainerType = '';
    @track filterAppliesScope = '';
    
    // Port lookup properties
    @track polDisplay = '';
    @track podDisplay = '';
    @track polSearchResults = [];
    @track podSearchResults = [];
    @track showPolDropdown = false;
    @track showPodDropdown = false;
    @track polLoading = false;
    @track podLoading = false;
    @track polNoResults = false;
    @track podNoResults = false;
    
    // Vendor and Contract options
    @track vendors = [];
    @track contracts = [];
    
    connectedCallback() {
        this.loadVendors();
    }
    
    async loadVendors() {
        try {
            const data = await listVendors({ vendorType: null, isActive: null });
            this.vendors = data || [];
        } catch (error) {
            console.error('Error loading vendors:', error);
        }
    }
    
    async loadContracts(vendorId) {
        try {
            if (!vendorId) {
                this.contracts = [];
                return;
            }
            const vendorIdDecimal = parseFloat(vendorId);
            const data = await listContracts({ vendorId: vendorIdDecimal, isActive: null });
            this.contracts = data || [];
        } catch (error) {
            console.error('Error loading contracts:', error);
            this.contracts = [];
        }
    }
    
    get vendorOptions() {
        return [
            { label: 'All Vendors', value: '' },
            ...this.vendors.map(v => ({
                label: v.name,
                value: String(v.id)
            }))
        ];
    }
    
    get contractOptions() {
        return [
            { label: 'All Contracts', value: '' },
            ...this.contracts.map(c => {
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
    
    get containerTypeOptions() {
        return [
            { label: 'All Container Types', value: '' },
            { label: '20GP', value: '20GP' },
            { label: '40GP', value: '40GP' },
            { label: '40HC', value: '40HC' },
            { label: '45HC', value: '45HC' },
            { label: '20RF', value: '20RF' },
            { label: '40RF', value: '40RF' }
        ];
    }
    
    get appliesScopeOptions() {
        return [
            { label: 'All Scopes', value: '' },
            { label: 'POL', value: 'pol' },
            { label: 'POD', value: 'pod' },
            { label: 'POL-POD', value: 'pol_pod' },
            { label: 'Global', value: 'global' }
        ];
    }
    
    get isContractDisabled() {
        return this.contracts.length === 0;
    }
    
    get hasRecords() {
        return this.surcharges && this.surcharges.length > 0;
    }
    
    get formattedRecords() {
        if (!this.surcharges) return [];
        
        return this.surcharges.map(record => {
            // Get vendor name from joined data
            const vendorName = record.vendor?.name || '—';
            
            // Get contract info from joined data
            const contractName = record.contract?.name || record.contract?.contract_number || '—';
            
            // Get location names from joined data
            const polDisplay = record.pol_location ? 
                `${record.pol_location.location_name} (${record.pol_location.unlocode})` : 
                '—';
            const podDisplay = record.pod_location ? 
                `${record.pod_location.location_name} (${record.pod_location.unlocode})` : 
                '—';
            
            return {
                ...record,
                id: String(record.id),
                displayChargeCode: record.charge_code || '—',
                displayAmount: record.amount ? `${record.amount}` : '—',
                displayCurrency: record.currency || 'USD',
                displayUom: record.uom || '—',
                displayPol: polDisplay,
                displayPod: podDisplay,
                displayContainerType: record.container_type || 'All',
                displayAppliesScope: this.formatAppliesScope(record.applies_scope),
                displayVendor: vendorName,
                displayContract: contractName
            };
        });
    }
    
    formatAppliesScope(scope) {
        if (!scope) return '—';
        const scopeMap = {
            'pol': 'POL',
            'pod': 'POD',
            'pol_pod': 'POL-POD',
            'global': 'Global'
        };
        return scopeMap[scope] || scope;
    }
    
    // Port Lookup Handlers
    handlePolInputChange(event) {
        this.polDisplay = event.target.value;
        if (this.polDisplay.length >= 2) {
            this.searchPol();
        } else {
            this.polSearchResults = [];
            this.showPolDropdown = false;
        }
    }
    
    handlePodInputChange(event) {
        this.podDisplay = event.target.value;
        if (this.podDisplay.length >= 2) {
            this.searchPod();
        } else {
            this.podSearchResults = [];
            this.showPodDropdown = false;
        }
    }
    
    async searchPol() {
        this.polLoading = true;
        this.polNoResults = false;
        try {
            const results = await searchPorts({ searchTerm: this.polDisplay, resultLimit: 10 });
            this.polSearchResults = results.map(port => ({
                code: port.code,
                label: `${port.name} (${port.country})`
            }));
            this.polNoResults = this.polSearchResults.length === 0;
            this.showPolDropdown = true;
        } catch (error) {
            console.error('Error searching POL:', error);
            this.polSearchResults = [];
        } finally {
            this.polLoading = false;
        }
    }
    
    async searchPod() {
        this.podLoading = true;
        this.podNoResults = false;
        try {
            const results = await searchPorts({ searchTerm: this.podDisplay, resultLimit: 10 });
            this.podSearchResults = results.map(port => ({
                code: port.code,
                label: `${port.name} (${port.country})`
            }));
            this.podNoResults = this.podSearchResults.length === 0;
            this.showPodDropdown = true;
        } catch (error) {
            console.error('Error searching POD:', error);
            this.podSearchResults = [];
        } finally {
            this.podLoading = false;
        }
    }
    
    handlePolFocus() {
        if (this.polSearchResults.length > 0) {
            this.showPolDropdown = true;
        }
    }
    
    handlePodFocus() {
        if (this.podSearchResults.length > 0) {
            this.showPodDropdown = true;
        }
    }
    
    handlePolBlur() {
        setTimeout(() => {
            this.showPolDropdown = false;
        }, 200);
    }
    
    handlePodBlur() {
        setTimeout(() => {
            this.showPodDropdown = false;
        }, 200);
    }
    
    handlePolSelect(event) {
        this.filterPolCode = event.currentTarget.dataset.code;
        this.polDisplay = event.currentTarget.dataset.label;
        this.showPolDropdown = false;
    }
    
    handlePodSelect(event) {
        this.filterPodCode = event.currentTarget.dataset.code;
        this.podDisplay = event.currentTarget.dataset.label;
        this.showPodDropdown = false;
    }
    
    // Filter handlers
    handleVendorChange(event) {
        this.filterVendorId = event.detail.value;
        this.loadContracts(this.filterVendorId);
    }
    
    handleContractChange(event) {
        this.filterContractId = event.detail.value;
    }
    
    handleContainerTypeChange(event) {
        this.filterContainerType = event.detail.value;
    }
    
    handleAppliesScopeChange(event) {
        this.filterAppliesScope = event.detail.value;
    }
    
    async handleFetchSurcharges() {
        this.loading = true;
        try {
            const vendorId = this.filterVendorId ? parseFloat(this.filterVendorId) : null;
            const contractId = this.filterContractId ? parseFloat(this.filterContractId) : null;
            
            const data = await listSurcharges({
                vendorId: vendorId,
                contractId: contractId,
                polCode: this.filterPolCode || null,
                podCode: this.filterPodCode || null,
                containerType: this.filterContainerType || null,
                appliesScope: this.filterAppliesScope || null
            });
            
            this.surcharges = data || [];
            
            if (this.surcharges.length === 0) {
                this.showToast('Info', 'No surcharges found', 'info');
            }
        } catch (error) {
            console.error('Error fetching surcharges:', error);
            this.showToast('Error', 'Failed to fetch surcharges: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleClearFilters() {
        this.filterVendorId = '';
        this.filterContractId = '';
        this.filterPolCode = '';
        this.filterPodCode = '';
        this.filterContainerType = '';
        this.filterAppliesScope = '';
        this.polDisplay = '';
        this.podDisplay = '';
        this.contracts = [];
        this.surcharges = [];
    }
    
    // Action handlers
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create', { 
            detail: { entityType: 'surcharges' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        const recordId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: recordId, entityType: 'surcharges' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleView(event) {
        const recordId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: recordId, entityType: 'surcharges' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        const recordId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: recordId, entityType: 'surcharges' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleUpload() {
        this.dispatchEvent(new CustomEvent('upload', {
            detail: { entityType: 'surcharges' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleExport() {
        this.dispatchEvent(new CustomEvent('export', {
            detail: { entityType: 'surcharges' },
            bubbles: true,
            composed: true
        }));
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }
}
