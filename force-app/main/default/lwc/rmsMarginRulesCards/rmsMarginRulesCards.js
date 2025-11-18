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
            // Map API field names to UI field names
            const scope = record.level; // API uses 'level'
            const type = record.mark_kind; // API uses 'mark_kind'
            const value = record.mark_value; // API uses 'mark_value'
            
            // Check if rule is active based on dates
            const now = new Date();
            const validFrom = record.valid_from ? new Date(record.valid_from) : null;
            const validTo = record.valid_to ? new Date(record.valid_to) : null;
            const isActive = (!validFrom || now >= validFrom) && (!validTo || now <= validTo);
            
            return {
                ...record,
                isSelected: isSelected,
                cardClass: isSelected ? 'margin-rule-card selected' : 'margin-rule-card',
                displayScope: this.formatScope(scope),
                displayType: this.formatType(type),
                displayValue: this.formatValue(value, type),
                displayPriority: record.priority || '—',
                displayStatus: isActive ? 'Active' : 'Inactive',
                displayReference: this.formatReference(record),
                statusClass: isActive ? 'status-badge active' : 'status-badge inactive',
                typeClass: this.getTypeClass(type),
                displayMode: record.mode || '—',
                displayContainer: record.container_type || 'All'
            };
        });
    }
    
    formatScope(level) {
        if (!level) return '—';
        const scopeMap = {
            'global': 'Global',
            'trade_zone': 'Trade Zone',
            'port_pair': 'Port Pair',
            'tz': 'Trade Zone', // Alternative mapping
            'pp': 'Port Pair'   // Alternative mapping
        };
        return scopeMap[level] || level.charAt(0).toUpperCase() + level.slice(1);
    }
    
    formatType(markKind) {
        if (!markKind) return '—';
        const typeMap = {
            'percentage': 'Percentage',
            'fixed': 'Fixed Amount',
            'multiplier': 'Multiplier',
            'percent': 'Percentage', // Alternative mapping
            'value': 'Fixed Amount'  // Alternative mapping
        };
        return typeMap[markKind] || markKind.charAt(0).toUpperCase() + markKind.slice(1);
    }
    
    formatValue(value, markKind) {
        if (value === null || value === undefined) return '—';
        if (markKind === 'percentage' || markKind === 'percent') {
            return `${value}%`;
        } else if (markKind === 'multiplier') {
            return `×${value}`;
        }
        return String(value);
    }
    
    formatReference(record) {
        const level = record.level;
        if (level === 'global') return 'All Locations';
        if (level === 'trade_zone' || level === 'tz') {
            const origin = record.tz_o || '—';
            const destination = record.tz_d || '—';
            return `${origin} → ${destination}`;
        }
        if (level === 'port_pair' || level === 'pp') {
            // Would need to lookup port codes from pol_id/pod_id
            return record.pol_id && record.pod_id ? `Port ${record.pol_id} → Port ${record.pod_id}` : '—';
        }
        return '—';
    }
    
    getTypeClass(markKind) {
        if (markKind === 'percentage' || markKind === 'percent') return 'type-badge percentage';
        if (markKind === 'fixed' || markKind === 'value') return 'type-badge fixed';
        if (markKind === 'multiplier') return 'type-badge multiplier';
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

