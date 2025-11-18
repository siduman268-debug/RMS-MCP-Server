import { LightningElement, api, track } from 'lwc';

export default class RmsSurchargesTable extends LightningElement {
    @api records = [];
    @api selectedRecords = [];
    
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
    
    get formattedRecords() {
        if (!this.records) return [];
        return this.records.map(record => ({
            ...record,
            isSelected: this.isRecordSelected(record.id),
            displayChargeCode: record.charge_code || '—',
            displayCurrency: record.currency || 'USD',
            displayAppliesScope: record.applies_scope || '—',
            displayUom: record.uom || '—',
            displayCalcMethod: record.calc_method || '—',
            formattedAmount: this.formatCurrency(record.amount, record.currency),
            formattedValidFrom: this.formatDate(record.valid_from),
            formattedValidTo: this.formatDate(record.valid_to)
        }));
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

