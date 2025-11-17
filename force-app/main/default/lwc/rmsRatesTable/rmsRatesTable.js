import { LightningElement, api, track } from 'lwc';
import searchPorts from '@salesforce/apex/RMSPortLookupService.searchPorts';
import searchTradeZones from '@salesforce/apex/RMSPortLookupService.searchTradeZones';

export default class RmsRatesTable extends LightningElement {
    @api records = [];
    @api selectedRecords = [];
    
    @track sortedBy;
    @track sortedDirection = 'asc';
    
    // Filters - Enhanced to match embedded version
    @track filterPolCode = '';
    @track filterPodCode = '';
    @track filterOrigin = ''; // v4 API field
    @track filterDestination = ''; // v4 API field
    @track filterOriginTradeZone = '';
    @track filterDestinationTradeZone = '';
    @track filterContainerType = '';
    @track filterVendorName = '';
    @track filterPreferred = '';
    
    // Port lookup (like scheduleSearch)
    @track polDisplay = '';
    @track podDisplay = '';
    @track polSearchResults = [];
    @track podSearchResults = [];
    @track showPolDropdown = false;
    @track showPodDropdown = false;
    @track polSearchLoading = false;
    @track podSearchLoading = false;
    @track polNoResults = false;
    @track podNoResults = false;
    
    // Trade Zone lookup
    @track originTradeZoneDisplay = '';
    @track destinationTradeZoneDisplay = '';
    @track originTradeZoneResults = [];
    @track destinationTradeZoneResults = [];
    @track showOriginTradeZoneDropdown = false;
    @track showDestinationTradeZoneDropdown = false;
    @track originTradeZoneLoading = false;
    @track destinationTradeZoneLoading = false;
    @track originTradeZoneNoResults = false;
    @track destinationTradeZoneNoResults = false;
    
    containerTypeOptions = [
        { label: 'All', value: '' },
        { label: '20GP', value: '20GP' },
        { label: '40GP', value: '40GP' },
        { label: '40HC', value: '40HC' },
        { label: '45HC', value: '45HC' }
    ];
    
    preferredOptions = [
        { label: 'All', value: '' },
        { label: 'Preferred Only', value: 'true' },
        { label: 'Non-Preferred Only', value: 'false' }
    ];
    
    handleCreate() {
        this.dispatchEvent(new CustomEvent('create'));
    }
    
    handleEdit(event) {
        this.dispatchEvent(new CustomEvent('edit', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'rates' }
        }));
    }
    
    handleView(event) {
        this.dispatchEvent(new CustomEvent('view', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'rates' }
        }));
    }
    
    handleDelete(event) {
        this.dispatchEvent(new CustomEvent('delete', {
            detail: { recordId: event.currentTarget.dataset.id, entityType: 'rates' }
        }));
    }
    
    handleMarkPreferred(event) {
        this.dispatchEvent(new CustomEvent('markpreferred', {
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
            let aVal, bVal;
            
            // Handle origin/destination fields - use display values for sorting
            if (fieldName === 'origin') {
                aVal = a.origin || a.pol_code || a.displayOrigin || '';
                bVal = b.origin || b.pol_code || b.displayOrigin || '';
            } else if (fieldName === 'destination') {
                aVal = a.destination || a.pod_code || a.displayDestination || '';
                bVal = b.destination || b.pod_code || b.displayDestination || '';
            } else {
                aVal = a[fieldName] || '';
                bVal = b[fieldName] || '';
            }
            
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
    
    // Carrier logo mapping - matches static resource names in Salesforce
    carrierLogoMap = {
        'MAERSK': '/resource/carrier_maersk',
        'MSC': '/resource/carrier_msc',
        'CMA CGM': '/resource/carrier_cma_cgm',
        'COSCO': '/resource/carrier_cosco',
        'EVERGREEN': '/resource/carrier_evergreen',
        'HAPAG-LLOYD': '/resource/carrier_hapag_lloyd',
        'ONE': '/resource/carrier_one',
        'YANG MING': '/resource/carrier_yang_ming',
        'ZIM': '/resource/carrier_zim',
        'OOCL': '/resource/carrier_oocl',
        'APL': '/resource/carrier_apl',
        'WAN HAI': '/resource/carrier_wan_hai',
        'CU LINES': '/resource/carrier_cu_lines',
        'RCL': '/resource/carrier_rcl',
        'GOLDSTAR': '/resource/carrier_goldstar',
        'HYUNDAI': '/resource/carrier_hyundai',
        'KAMBARA': '/resource/carrier_kambara',
        'X-PRESS': '/resource/carrier_xpress',
        'EMIRATES': '/resource/carrier_emirates',
        'SAMUDERA': '/resource/carrier_samudera',
        'FEEDERTECH': '/resource/carrier_feedert tech',
        'UAFL': '/resource/carrier_uafl',
        'PIL': '/resource/carrier_pil',
        'KMTC': '/resource/carrier_kmtc',
        'MESSINA': '/resource/carrier_messina',
        'LAUREL': '/resource/carrier_laurel',
        'SINOKOR': '/resource/carrier_sinokor'
    };
    
    getCarrierLogo(carrierName) {
        if (!carrierName) return null;
        const carrierUpper = carrierName.toUpperCase().trim();
        
        // Exact match
        if (this.carrierLogoMap[carrierUpper]) {
            return this.carrierLogoMap[carrierUpper];
        }
        
        // Partial match (e.g., "MAERSK LINE" matches "MAERSK")
        for (const [key, logoPath] of Object.entries(this.carrierLogoMap)) {
            if (carrierUpper.includes(key) || key.includes(carrierUpper)) {
                return logoPath;
            }
        }
        
        return null;
    }
    
    get formattedRecords() {
        if (!this.records) return [];
        return this.records.map(record => {
            // Use origin/destination fields if available (v4 API), otherwise fallback to pol_code/pod_code
            const originCode = record.origin || record.pol_code || '';
            const destinationCode = record.destination || record.pod_code || '';
            let originName = record.origin_name || record.pol_name || '';
            let destinationName = record.destination_name || record.pod_name || '';
            
            // Remove code from name if it's already included (e.g., "Port Name (CODE)" -> "Port Name")
            if (originName && originCode) {
                // Check if name already contains the code in brackets
                const codePattern = new RegExp(`\\s*\\(${originCode}\\)\\s*$`, 'i');
                if (codePattern.test(originName)) {
                    originName = originName.replace(codePattern, '').trim();
                }
            }
            
            if (destinationName && destinationCode) {
                // Check if name already contains the code in brackets
                const codePattern = new RegExp(`\\s*\\(${destinationCode}\\)\\s*$`, 'i');
                if (codePattern.test(destinationName)) {
                    destinationName = destinationName.replace(codePattern, '').trim();
                }
            }
            
            // Display port names with codes (e.g., "Nhava Sheva (INNSA)")
            const displayOrigin = originName ? `${originName} (${originCode})` : (originCode || '—');
            const displayDestination = destinationName ? `${destinationName} (${destinationCode})` : (destinationCode || '—');
            
            return {
                ...record,
                isSelected: this.isRecordSelected(record.id),
                // Origin/Destination display
                originCode: originCode,
                destinationCode: destinationCode,
                displayOrigin: displayOrigin,
                displayDestination: displayDestination,
                // Legacy support (keep for compatibility)
                displayPol: displayOrigin,
                displayPod: displayDestination,
                displayContainerType: record.container_type || '—',
                displayCarrier: record.carrier || record.vendor || '—',
                carrierLogoUrl: this.getCarrierLogo(record.carrier || record.vendor),
                // Format transit days as "20d"
                displayTransitDays: record.tt_days || record.transit_days ? `${record.tt_days || record.transit_days}d` : '—',
                // ALL-IN BUY (use all_in_freight_buy if available, otherwise buy_amount)
                allInBuy: record.all_in_freight_buy || record.buy_amount || 0,
                formattedAllInBuy: this.formatCurrency(record.all_in_freight_buy || record.buy_amount, record.currency),
                // ALL-IN SELL
                allInSell: record.all_in_freight_sell || 0,
                formattedAllInSell: this.formatCurrency(record.all_in_freight_sell, record.currency),
                // MARGIN
                marginAmount: record.margin_amount || 0,
                formattedMargin: this.formatCurrency(record.margin_amount, record.currency),
                // MARGIN %
                marginPercentage: record.margin_percentage || 0,
                formattedMarginPercentage: record.margin_percentage ? `${(record.margin_percentage).toFixed(1)}%` : '—',
                displayCurrency: record.currency || 'USD',
                formattedValidFrom: this.formatDate(record.valid_from),
                formattedValidTo: this.formatDate(record.valid_to)
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
    
    formatCurrency(amount, currency) {
        if (amount === null || amount === undefined) return '';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD'
        }).format(amount);
    }
    
    // Port lookup handlers (similar to scheduleSearch)
    handlePolInputChange(event) {
        const searchTerm = event.target.value;
        this.polDisplay = searchTerm;
        
        if (searchTerm && searchTerm.length >= 2) {
            this.searchPolPorts(searchTerm);
        } else {
            this.showPolDropdown = false;
            this.polSearchResults = [];
        }
    }
    
    handlePodInputChange(event) {
        const searchTerm = event.target.value;
        this.podDisplay = searchTerm;
        
        if (searchTerm && searchTerm.length >= 2) {
            this.searchPodPorts(searchTerm);
        } else {
            this.showPodDropdown = false;
            this.podSearchResults = [];
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
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        const code = event.currentTarget.dataset.code;
        
        // Store both pol_code (for API) and origin (for display)
        this.filterPolCode = code;
        this.filterOrigin = code; // v4 API uses 'origin' field
        this.polDisplay = label || value;
        this.showPolDropdown = false;
        this.polSearchResults = [];
        
        this.triggerFilterChange();
    }
    
    handlePodSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        const code = event.currentTarget.dataset.code;
        
        // Store both pod_code (for API) and destination (for display)
        this.filterPodCode = code;
        this.filterDestination = code; // v4 API uses 'destination' field
        this.podDisplay = label || value;
        this.showPodDropdown = false;
        this.podSearchResults = [];
        
        this.triggerFilterChange();
    }
    
    searchPolPorts(searchTerm) {
        this.polSearchLoading = true;
        this.polNoResults = false;
        this.showPolDropdown = true;
        
        searchPorts({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                const ports = result || [];
                this.polSearchResults = ports.map(port => {
                    const label = port.label || port.value || '';
                    const codeMatch = label.match(/\(([A-Z]{5})\)/);
                    const code = codeMatch ? codeMatch[1] : (port.value || port.code || '');
                    const country = (port.country && port.country.trim()) || null;
                    const state = (port.state && port.state.trim()) || null;
                    
                    return {
                        label: label.replace(/\s*\([A-Z]{5}\)\s*$/, ''),
                        code: code,
                        value: port.value || label,
                        country: country,
                        state: state,
                        locationDisplay: country ? (state ? `${state}, ${country}` : country) : ''
                    };
                });
                this.polSearchLoading = false;
                this.polNoResults = this.polSearchResults.length === 0;
            })
            .catch(error => {
                console.error('Error searching POL ports:', error);
                this.polSearchLoading = false;
                this.polNoResults = true;
                this.polSearchResults = [];
            });
    }
    
    searchPodPorts(searchTerm) {
        this.podSearchLoading = true;
        this.podNoResults = false;
        this.showPodDropdown = true;
        
        searchPorts({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                const ports = result || [];
                this.podSearchResults = ports.map(port => {
                    const label = port.label || port.value || '';
                    const codeMatch = label.match(/\(([A-Z]{5})\)/);
                    const code = codeMatch ? codeMatch[1] : (port.value || port.code || '');
                    const country = (port.country && port.country.trim()) || null;
                    const state = (port.state && port.state.trim()) || null;
                    
                    return {
                        label: label.replace(/\s*\([A-Z]{5}\)\s*$/, ''),
                        code: code,
                        value: port.value || label,
                        country: country,
                        state: state,
                        locationDisplay: country ? (state ? `${state}, ${country}` : country) : ''
                    };
                });
                this.podSearchLoading = false;
                this.podNoResults = this.podSearchResults.length === 0;
            })
            .catch(error => {
                console.error('Error searching POD ports:', error);
                this.podSearchLoading = false;
                this.podNoResults = true;
                this.podSearchResults = [];
            });
    }
    
    handleFilterChange(event) {
        const filterName = event.currentTarget.dataset.filter;
        const filterValue = event.target.value;
        
        // Update local filter state
        this[`filter${this.capitalize(filterName)}`] = filterValue;
        
        this.triggerFilterChange();
    }
    
    triggerFilterChange() {
        // Dispatch filter change event to parent
        // Prefer origin/destination (v4 API), fallback to pol_code/pod_code for backward compatibility
        const filters = {};
        if (this.filterOrigin) {
            filters.origin = this.filterOrigin;
        } else if (this.filterPolCode) {
            filters.pol_code = this.filterPolCode;
        }
        
        if (this.filterDestination) {
            filters.destination = this.filterDestination;
        } else if (this.filterPodCode) {
            filters.pod_code = this.filterPodCode;
        }
        
        if (this.filterOriginTradeZone) filters.origin_trade_zone = this.filterOriginTradeZone;
        if (this.filterDestinationTradeZone) filters.destination_trade_zone = this.filterDestinationTradeZone;
        if (this.filterContainerType) filters.container_type = this.filterContainerType;
        if (this.filterVendorName) filters.vendor_name = this.filterVendorName;
        if (this.filterPreferred) filters.is_preferred = this.filterPreferred;
        
        this.dispatchEvent(new CustomEvent('filterchange', {
            detail: { filters: filters }
        }));
    }
    
    handleFetchRates() {
        // Trigger filter change to fetch rates with current filters
        this.triggerFilterChange();
    }
    
    handleClearFilters() {
        this.filterPolCode = '';
        this.filterPodCode = '';
        this.filterOrigin = '';
        this.filterDestination = '';
        this.filterOriginTradeZone = '';
        this.filterDestinationTradeZone = '';
        this.filterContainerType = '';
        this.filterVendorName = '';
        this.filterPreferred = '';
        this.polDisplay = '';
        this.podDisplay = '';
        this.originTradeZoneDisplay = '';
        this.destinationTradeZoneDisplay = '';
        this.polSearchResults = [];
        this.podSearchResults = [];
        this.originTradeZoneResults = [];
        this.destinationTradeZoneResults = [];
        
        this.dispatchEvent(new CustomEvent('filterchange', {
            detail: { filters: {} }
        }));
    }
    
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }
    
    // Trade Zone lookup handlers
    handleOriginTradeZoneInputChange(event) {
        const searchTerm = event.target.value;
        this.originTradeZoneDisplay = searchTerm;
        
        if (searchTerm && searchTerm.length >= 2) {
            this.searchOriginTradeZones(searchTerm);
        } else {
            this.showOriginTradeZoneDropdown = false;
            this.originTradeZoneResults = [];
        }
    }
    
    handleDestinationTradeZoneInputChange(event) {
        const searchTerm = event.target.value;
        this.destinationTradeZoneDisplay = searchTerm;
        
        if (searchTerm && searchTerm.length >= 2) {
            this.searchDestinationTradeZones(searchTerm);
        } else {
            this.showDestinationTradeZoneDropdown = false;
            this.destinationTradeZoneResults = [];
        }
    }
    
    handleOriginTradeZoneFocus() {
        if (this.originTradeZoneResults.length > 0) {
            this.showOriginTradeZoneDropdown = true;
        }
    }
    
    handleDestinationTradeZoneFocus() {
        if (this.destinationTradeZoneResults.length > 0) {
            this.showDestinationTradeZoneDropdown = true;
        }
    }
    
    handleOriginTradeZoneBlur() {
        setTimeout(() => {
            this.showOriginTradeZoneDropdown = false;
        }, 200);
    }
    
    handleDestinationTradeZoneBlur() {
        setTimeout(() => {
            this.showDestinationTradeZoneDropdown = false;
        }, 200);
    }
    
    handleOriginTradeZoneSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        
        this.filterOriginTradeZone = value;
        this.originTradeZoneDisplay = label || value;
        this.showOriginTradeZoneDropdown = false;
        this.originTradeZoneResults = [];
        
        this.triggerFilterChange();
    }
    
    handleDestinationTradeZoneSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        
        this.filterDestinationTradeZone = value;
        this.destinationTradeZoneDisplay = label || value;
        this.showDestinationTradeZoneDropdown = false;
        this.destinationTradeZoneResults = [];
        
        this.triggerFilterChange();
    }
    
    searchOriginTradeZones(searchTerm) {
        this.originTradeZoneLoading = true;
        this.originTradeZoneNoResults = false;
        this.showOriginTradeZoneDropdown = true;
        
        searchTradeZones({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                const tradeZones = result || [];
                this.originTradeZoneResults = tradeZones.map(tz => ({
                    label: tz.label || tz.value || '',
                    value: tz.value || tz.label || ''
                }));
                this.originTradeZoneLoading = false;
                this.originTradeZoneNoResults = this.originTradeZoneResults.length === 0;
            })
            .catch(error => {
                console.error('Error searching origin trade zones:', error);
                this.originTradeZoneLoading = false;
                this.originTradeZoneNoResults = true;
                this.originTradeZoneResults = [];
            });
    }
    
    searchDestinationTradeZones(searchTerm) {
        this.destinationTradeZoneLoading = true;
        this.destinationTradeZoneNoResults = false;
        this.showDestinationTradeZoneDropdown = true;
        
        searchTradeZones({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                const tradeZones = result || [];
                this.destinationTradeZoneResults = tradeZones.map(tz => ({
                    label: tz.label || tz.value || '',
                    value: tz.value || tz.label || ''
                }));
                this.destinationTradeZoneLoading = false;
                this.destinationTradeZoneNoResults = this.destinationTradeZoneResults.length === 0;
            })
            .catch(error => {
                console.error('Error searching destination trade zones:', error);
                this.destinationTradeZoneLoading = false;
                this.destinationTradeZoneNoResults = true;
                this.destinationTradeZoneResults = [];
            });
    }
}

