import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class RmsVendorsTable extends LightningElement {
    @api records = [];
    @api selectedRecords = [];
    
    // Vendor/Carrier logo mapping - matches static resource names in Salesforce
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
    
    get isSortedByName() {
        return this.sortedBy === 'name';
    }
    
    get isSortedByAlias() {
        return this.sortedBy === 'alias';
    }
    
    get isSortedByType() {
        return this.sortedBy === 'type';
    }
    
    get sortIconName() {
        return this.sortedDirection === 'asc' ? 'utility:arrowup' : 'utility:arrowdown';
    }
    
    handleSort(event) {
        const fieldName = event.currentTarget.dataset.field;
        const sortDirection = this.sortedBy === fieldName && this.sortedDirection === 'asc' ? 'desc' : 'asc';
        
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
        
        // Sort records
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
    
    get formattedRecords() {
        if (!this.records) return [];
        return this.records.map(record => {
            const logoPath = this.getVendorLogo(record.name);
            const initials = this.getVendorInitials(record.name);
            
            return {
                ...record,
                isSelected: this.isRecordSelected(record.id),
                displayAlias: record.alias || '—',
                displayType: this.formatVendorType(record.vendor_type),
                displayMode: this.formatMode(record.mode),
                formattedDate: this.formatDate(record.valid_from),
                logoPath: logoPath,
                hasLogo: !!logoPath,
                initials: initials
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
    
    formatVendorType(type) {
        if (!type) return '—';
        return type.replace(/_/g, ' ').toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    formatMode(mode) {
        if (!mode || !Array.isArray(mode) || mode.length === 0) return '—';
        return mode.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
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
    
    formatCurrency(amount, currency) {
        if (amount === null || amount === undefined) return '';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD'
        }).format(amount);
    }
}

