import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import listMarginRules from '@salesforce/apex/RMSMarginRuleService.listMarginRules';

export default class RmsMarginRulesCards extends LightningElement {
    @api records = [];
    @api selectedRecords = [];
    
    @track loading = false;
    @track rules = [];
    @track filterScope = '';
    
    get scopeOptions() {
        return [
            { label: 'All Scopes', value: '' },
            { label: 'Global', value: 'global' },
            { label: 'Trade Zone', value: 'trade_zone' },
            { label: 'Port Pair', value: 'port_pair' }
        ];
    }
    
    get hasRecords() {
        return this.filteredRecords && this.filteredRecords.length > 0;
    }
    
    get filteredRecords() {
        if (!this.rules) return [];
        
        let filtered = [...this.rules];
        
        // Apply scope filter
        if (this.filterScope) {
            filtered = filtered.filter(rule => rule.scope === this.filterScope);
        }
        
        return filtered;
    }
    
    get formattedRecords() {
        return this.filteredRecords.map(record => {
            const isSelected = this.isRecordSelected(record.id);
            
            return {
                ...record,
                isSelected: isSelected,
                cardClass: isSelected ? 'margin-rule-card selected' : 'margin-rule-card',
                displayScope: this.formatScope(record.scope),
                displayType: this.formatType(record.type),
                displayValue: this.formatValue(record.value, record.type),
                displayPriority: record.priority || '—',
                displayStatus: record.is_active ? 'Active' : 'Inactive',
                displayReference: this.formatReference(record),
                statusClass: record.is_active ? 'status-badge active' : 'status-badge inactive',
                typeClass: this.getTypeClass(record.type)
            };
        });
    }
    
    formatScope(scope) {
        if (!scope) return '—';
        const scopeMap = {
            'global': 'Global',
            'trade_zone': 'Trade Zone',
            'port_pair': 'Port Pair'
        };
        return scopeMap[scope] || scope;
    }
    
    formatType(type) {
        if (!type) return '—';
        const typeMap = {
            'percentage': 'Percentage',
            'fixed': 'Fixed Amount',
            'multiplier': 'Multiplier'
        };
        return typeMap[type] || type;
    }
    
    formatValue(value, type) {
        if (value === null || value === undefined) return '—';
        if (type === 'percentage') {
            return `${value}%`;
        } else if (type === 'multiplier') {
            return `×${value}`;
        }
        return String(value);
    }
    
    formatReference(record) {
        if (record.scope === 'global') return 'All';
        if (record.scope === 'trade_zone') {
            return `${record.pol_trade_zone || '—'} → ${record.pod_trade_zone || '—'}`;
        }
        if (record.scope === 'port_pair') {
            return `${record.pol_code || '—'} → ${record.pod_code || '—'}`;
        }
        return '—';
    }
    
    getTypeClass(type) {
        if (type === 'percentage') return 'type-badge percentage';
        if (type === 'fixed') return 'type-badge fixed';
        if (type === 'multiplier') return 'type-badge multiplier';
        return 'type-badge';
    }
    
    isRecordSelected(recordId) {
        return this.selectedRecords && this.selectedRecords.includes(recordId);
    }
    
    handleFilterScopeChange(event) {
        this.filterScope = event.detail.value;
    }
    
    async handleFetchRules() {
        this.loading = true;
        try {
            const data = await listMarginRules({
                scope: this.filterScope || null
            });
            
            this.rules = data || [];
            
            if (this.rules.length === 0) {
                this.showToast('Info', 'No margin rules found', 'info');
            }
        } catch (error) {
            console.error('Error fetching margin rules:', error);
            this.showToast('Error', 'Failed to fetch margin rules: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleClearFilters() {
        this.filterScope = '';
        this.rules = [];
    }
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create', { 
            detail: { entityType: 'marginRules' } 
        }));
    }
    
    handleView(event) {
        const recordId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: recordId, entityType: 'marginRules' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleEdit(event) {
        const recordId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: recordId, entityType: 'marginRules' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleDelete(event) {
        const recordId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: recordId, entityType: 'marginRules' },
            bubbles: true,
            composed: true
        }));
    }
    
    handleSelectRecord(event) {
        const recordId = event.target.value;
        this.dispatchEvent(new CustomEvent('selectrecord', {
            detail: { recordId: recordId }
        }));
    }
    
    handleUpload() {
        this.dispatchEvent(new CustomEvent('upload'));
    }
    
    handleExport() {
        this.dispatchEvent(new CustomEvent('export'));
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }
}

