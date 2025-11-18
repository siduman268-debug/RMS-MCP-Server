import { LightningElement, api, track } from 'lwc';

export default class RmsContractsTable extends LightningElement {
    @api records = [];
    @api selectedRecords = [];
    
    // Vendor/Carrier logo mapping - matches static resource names
    vendorLogoMap = {
        'MAERSK': '/resource/carrier_maersk',
        'MSC': '/resource/carrier_msc',
        'CMA CGM': '/resource/carrier_cma_cgm',
        'CMA': '/resource/carrier_cma_cgm',
        'COSCO': '/resource/carrier_cosco',
        'EVERGREEN': '/resource/carrier_evergreen',
        'HAPAG': '/resource/carrier_hapag_lloyd',
        'HAPAG-LLOYD': '/resource/carrier_hapag_lloyd',
        'ONE': '/resource/carrier_one',
        'YANG MING': '/resource/carrier_yang_ming',
        'ZIM': '/resource/carrier_zim',
        'OOCL': '/resource/carrier_oocl',
        'ACME': '/resource/carrier_acme',
        'ACME LINES': '/resource/carrier_acme',
        'GENERIC': '/resource/carrier_generic',
        'GENERIC CARRIER': '/resource/carrier_generic'
    };
    
    @track sortedBy;
    @track sortedDirection = 'asc';
    
    // Filter properties
    @track filterVendor = '';
    @track filterContractNumber = '';
    @track filterType = '';
    @track filterStatus = '';
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create'));
    }
    
    handleEdit(event) {
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: event.currentTarget.dataset.id }
        }));
    }
    
    handleView(event) {
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: event.currentTarget.dataset.id }
        }));
    }
    
    handleDelete(event) {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: event.currentTarget.dataset.id }
        }));
    }
    
    handleUpload() {
        this.dispatchEvent(new CustomEvent('upload'));
    }
    
    handleExport() {
        this.dispatchEvent(new CustomEvent('export'));
    }
    
    handleSelectAll(event) {
        this.dispatchEvent(new CustomEvent('selectall', {
            detail: { checked: event.target.checked }
        }));
    }
    
    handleSelectRecord(event) {
        this.dispatchEvent(new CustomEvent('selectrecord', {
            detail: { 
                recordId: event.currentTarget.value,
                checked: event.target.checked
            }
        }));
    }
    
    get isSortedByContractNumber() {
        return this.sortedBy === 'contract_number';
    }
    
    get isSortedByVendorId() {
        return this.sortedBy === 'vendor_id';
    }
    
    get sortIconName() {
        return this.sortedDirection === 'asc' ? 'utility:arrowup' : 'utility:arrowdown';
    }
    
    handleSort(event) {
        const fieldName = event.currentTarget.dataset.field;
        const sortDirection = this.sortedBy === fieldName && this.sortedDirection === 'asc' ? 'desc' : 'asc';
        
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
        
        const records = [...this.records];
        records.sort((a, b) => {
            let aVal = a[fieldName] || '';
            let bVal = b[fieldName] || '';
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            }
            return aVal < bVal ? 1 : -1;
        });
        
        this.records = records;
    }
    
    get hasRecords() {
        return this.records && this.records.length > 0;
    }
    
    get allSelected() {
        return this.hasRecords && this.selectedRecords && this.selectedRecords.length === this.records.length;
    }
    
    isRecordSelected(recordId) {
        return this.selectedRecords && this.selectedRecords.includes(recordId);
    }
    
    get typeOptions() {
        return [
            { label: 'All Types', value: '' },
            { label: 'SPOT', value: 'spot' },
            { label: 'CONTRACT', value: 'contract' }
        ];
    }
    
    get statusOptions() {
        return [
            { label: 'All Status', value: '' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' }
        ];
    }
    
    get filteredRecords() {
        if (!this.records) return [];
        
        return this.records.filter(record => {
            // Vendor name filter
            if (this.filterVendor && record.vendor_name) {
                if (!record.vendor_name.toLowerCase().includes(this.filterVendor.toLowerCase())) {
                    return false;
                }
            }
            
            // Contract number filter
            if (this.filterContractNumber) {
                const contractNum = record.contract_number || record.name || '';
                if (!contractNum.toLowerCase().includes(this.filterContractNumber.toLowerCase())) {
                    return false;
                }
            }
            
            // Type filter
            if (this.filterType) {
                const isSpot = record.is_spot === true || record.is_spot === 'true';
                if (this.filterType === 'spot' && !isSpot) return false;
                if (this.filterType === 'contract' && isSpot) return false;
            }
            
            // Status filter
            if (this.filterStatus) {
                const isActive = record.is_active === true || record.is_active === 'true';
                if (this.filterStatus === 'active' && !isActive) return false;
                if (this.filterStatus === 'inactive' && isActive) return false;
            }
            
            return true;
        });
    }
    
    get formattedRecords() {
        return this.filteredRecords.map(record => {
            const isSelected = this.isRecordSelected(record.id);
            const logoPath = this.getVendorLogo(record.vendor_name);
            const initials = this.getVendorInitials(record.vendor_name);
            
            return {
                ...record,
                isSelected: isSelected,
                cardClass: isSelected ? 'contract-card selected' : 'contract-card',
                displayContractNumber: record.contract_number || `Contract ${record.id}`,
                displayVendorName: record.vendor_name || 'Unknown Vendor',
                displayMode: this.formatMode(record.mode),
                formattedValidFrom: this.formatDate(record.effective_from || record.valid_from),
                formattedValidTo: this.formatDate(record.effective_to || record.valid_to),
                typeClass: record.is_spot ? 'contract-type-badge spot' : 'contract-type-badge contract',
                typeLabel: record.is_spot ? 'SPOT' : 'CONTRACT',
                logoPath: logoPath,
                hasLogo: !!logoPath,
                vendorInitials: initials
            };
        });
    }
    
    getVendorLogo(vendorName) {
        if (!vendorName) return null;
        
        const nameUpper = vendorName.toUpperCase().trim();
        
        // Check exact match first
        if (this.vendorLogoMap[nameUpper]) {
            return this.vendorLogoMap[nameUpper];
        }
        
        // Check if vendor name contains any of the known carriers
        for (const [key, value] of Object.entries(this.vendorLogoMap)) {
            if (nameUpper.includes(key)) {
                return value;
            }
        }
        
        return null;
    }
    
    getVendorInitials(name) {
        if (!name) return 'V';
        const words = name.split(' ').filter(w => w.length > 0);
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
        return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
    
    formatMode(mode) {
        if (!mode) return '—';
        if (typeof mode === 'string') return mode.charAt(0).toUpperCase() + mode.slice(1);
        if (Array.isArray(mode) && mode.length > 0) {
            return mode.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
        }
        return '—';
    }
    
    handleFilterVendorChange(event) {
        this.filterVendor = event.target.value;
    }
    
    handleFilterContractNumberChange(event) {
        this.filterContractNumber = event.target.value;
    }
    
    handleFilterTypeChange(event) {
        this.filterType = event.detail.value;
    }
    
    handleFilterStatusChange(event) {
        this.filterStatus = event.detail.value;
    }
    
    handleClearFilters() {
        this.filterVendor = '';
        this.filterContractNumber = '';
        this.filterType = '';
        this.filterStatus = '';
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
}

