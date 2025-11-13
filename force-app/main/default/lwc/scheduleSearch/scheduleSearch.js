import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSchedules from '@salesforce/apex/RMSScheduleService.getSchedules';
import getCommonPorts from '@salesforce/apex/RMSPortLookupService.getCommonPorts';
import searchPorts from '@salesforce/apex/RMSPortLookupService.searchPorts';

// Import carrier logos from static resources (optional - will fallback to text if not available)
// Note: Static resources must be created in Salesforce Setup > Static Resources
// Expected resource names: maersk_logo, msc_logo, cma_logo, cosco_logo, evergreen_logo, hapag_logo, oocl_logo, yang_ming_logo, zim_logo

export default class ScheduleSearch extends LightningElement {
    @track schedules = [];
    @track filteredSchedules = [];
    @track isLoading = false;
    
    // Search parameters
    @track origin = '';
    @track destination = '';
    @track departureFrom = '';
    @track departureTo = '';
    @track weeks = 4;
    @track limit = 100;
    
    // Client-side filters
    @track filterCarrier = '';
    @track filterService = '';
    @track filterVessel = '';
    @track filterVoyage = '';
    @track filterDirectOnly = false;
    @track filterEtaFrom = '';
    @track filterEtaTo = '';
    
    // Pagination
    @track currentPage = 1;
    @track pageSize = 20;
    @track totalRecords = 0;
    
    // Sort options
    @track sortBy = 'etd'; // etd, eta, transit_time_days
    @track sortDirection = 'asc'; // asc, desc
    
    // Unique filter values (populated from data)
    @track uniqueCarriers = [];
    @track uniqueServices = [];
    @track uniqueVessels = [];
    @track uniqueVoyages = [];
    
    // Filter options for picklists
    @track carrierOptions = [];
    @track serviceOptions = [];
    @track vesselOptions = [];
    @track voyageOptions = [];
    
    // Metadata
    @track metadata = null;
    @track hasSearched = false;
    
    // Port lookup options
    @track originOptions = [];
    @track destinationOptions = [];
    
    // Route details modal
    @track showRouteDetailsModal = false;
    @track selectedSchedule = null;
    
    // Carrier logo mapping - matches static resource names in Salesforce
    // Static resources use naming convention: carrier_<carrier_name>
    carrierLogoMap = {
        'MAERSK': '/resource/carrier_maersk',
        'MSC': '/resource/carrier_msc',
        'CMA CGM': '/resource/carrier_cma_cgm',
        'CMA': '/resource/carrier_cma_cgm',
        'COSCO': '/resource/carrier_cosco',
        'COSCO SHIPPING': '/resource/carrier_cosco',
        'HAPAG LLOYD': '/resource/carrier_hapag_lloyd',
        'HAPAG': '/resource/carrier_hapag_lloyd'
    };
    
    getCarrierLogo(carrierName) {
        if (!carrierName) return null;
        const carrierUpper = carrierName.toUpperCase();
        // Try exact match first
        if (this.carrierLogoMap[carrierUpper]) {
            return this.carrierLogoMap[carrierUpper];
        }
        // Try partial match
        for (const [key, logoPath] of Object.entries(this.carrierLogoMap)) {
            if (carrierUpper.includes(key) || key.includes(carrierUpper)) {
                return logoPath;
            }
        }
        return null;
    }
    
    connectedCallback() {
        // Initialize with today's date
        const today = new Date();
        this.departureFrom = today.toISOString().split('T')[0];
        
        // Load common ports
        this.loadCommonPorts();
    }
    
    loadCommonPorts() {
        getCommonPorts()
            .then(result => {
                this.originOptions = (result || []).map(port => ({
                    label: port.label,
                    value: port.value
                }));
                this.destinationOptions = (result || []).map(port => ({
                    label: port.label,
                    value: port.value
                }));
            })
            .catch(error => {
                console.error('Error loading common ports:', error);
            });
    }
    
    handleOriginChange(event) {
        const selectedValue = event.detail.value;
        this.origin = selectedValue || '';
    }
    
    handleDestinationChange(event) {
        const selectedValue = event.detail.value;
        this.destination = selectedValue || '';
    }
    
    handleOriginSearch(event) {
        const searchTerm = event.detail.searchTerm || '';
        if (searchTerm && searchTerm.length >= 2) {
            this.searchOriginPorts(searchTerm);
        } else if (searchTerm.length === 0) {
            // Reset to common ports when search is cleared
            this.loadCommonPorts();
        }
    }
    
    handleDestinationSearch(event) {
        const searchTerm = event.detail.searchTerm || '';
        if (searchTerm && searchTerm.length >= 2) {
            this.searchDestinationPorts(searchTerm);
        } else if (searchTerm.length === 0) {
            // Reset to common ports when search is cleared
            this.loadCommonPorts();
        }
    }
    
    searchOriginPorts(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            this.loadCommonPorts();
            return;
        }
        searchPorts({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                if (result && result.length > 0) {
                    this.originOptions = result.map(port => ({
                        label: port.label,
                        value: port.value
                    }));
                } else {
                    // If no results, keep common ports
                    this.loadCommonPorts();
                }
            })
            .catch(error => {
                console.error('Error searching origin ports:', error);
                // On error, fallback to common ports
                this.loadCommonPorts();
            });
    }
    
    searchDestinationPorts(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            this.loadCommonPorts();
            return;
        }
        searchPorts({ searchTerm: searchTerm, resultLimit: 50 })
            .then(result => {
                if (result && result.length > 0) {
                    this.destinationOptions = result.map(port => ({
                        label: port.label,
                        value: port.value
                    }));
                } else {
                    // If no results, keep common ports
                    this.loadCommonPorts();
                }
            })
            .catch(error => {
                console.error('Error searching destination ports:', error);
                // On error, fallback to common ports
                this.loadCommonPorts();
            });
    }
    
    
    handleDepartureFromChange(event) {
        this.departureFrom = event.target.value;
    }
    
    handleDepartureToChange(event) {
        this.departureTo = event.target.value;
    }
    
    handleWeeksChange(event) {
        this.weeks = parseInt(event.target.value, 10);
        // Calculate departureTo if departureFrom is set
        if (this.departureFrom) {
            const fromDate = new Date(this.departureFrom);
            fromDate.setDate(fromDate.getDate() + (this.weeks * 7));
            this.departureTo = fromDate.toISOString().split('T')[0];
        }
    }
    
    handleLimitChange(event) {
        this.limit = parseInt(event.target.value, 10);
    }
    
    // Filter handlers
    handleFilterCarrierChange(event) {
        this.filterCarrier = event.target.value;
        this.applyFilters();
    }
    
    handleFilterServiceChange(event) {
        this.filterService = event.target.value;
        this.applyFilters();
    }
    
    handleFilterVesselChange(event) {
        this.filterVessel = event.target.value;
        this.applyFilters();
    }
    
    handleFilterVoyageChange(event) {
        this.filterVoyage = event.target.value;
        this.applyFilters();
    }
    
    handleFilterDirectOnlyChange(event) {
        this.filterDirectOnly = event.target.checked;
        this.applyFilters();
    }
    
    handleFilterEtaFromChange(event) {
        this.filterEtaFrom = event.target.value;
        this.applyFilters();
    }
    
    handleFilterEtaToChange(event) {
        this.filterEtaTo = event.target.value;
        this.applyFilters();
    }
    
    handleSortChange(event) {
        event.preventDefault();
        const field = event.currentTarget.dataset.field;
        if (this.sortBy === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortBy = field;
            this.sortDirection = 'asc';
        }
        this.applyFilters();
    }
    
    handleSearch() {
        // Get the UN/LOCODE value (combobox returns the value directly)
        let originCode = this.origin;
        if (!originCode || originCode.trim() === '') {
            this.showToast('Error', 'Origin port is required', 'error');
            return;
        }
        
        // Extract UN/LOCODE if user selected from dropdown (value is already the code)
        // But check if it's in format "Port Name (CODE)" and extract code
        if (originCode.includes('(') && originCode.includes(')')) {
            const match = originCode.match(/\(([A-Z]{2}[A-Z0-9]{3})\)/);
            if (match && match[1]) {
                originCode = match[1];
            }
        }
        
        // Extract destination code if provided
        let destinationCode = this.destination || null;
        if (destinationCode && destinationCode.includes('(') && destinationCode.includes(')')) {
            const match = destinationCode.match(/\(([A-Z]{2}[A-Z0-9]{3})\)/);
            if (match && match[1]) {
                destinationCode = match[1];
            }
        }
        
        // Ensure codes are uppercase and valid format
        originCode = originCode.trim().toUpperCase();
        if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(originCode)) {
            this.showToast('Error', 'Invalid origin port UN/LOCODE format. Please select from the dropdown.', 'error');
            return;
        }
        
        if (destinationCode) {
            destinationCode = destinationCode.trim().toUpperCase();
            if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(destinationCode)) {
                this.showToast('Error', 'Invalid destination port UN/LOCODE format. Please select from the dropdown.', 'error');
                return;
            }
        }
        
        this.isLoading = true;
        this.hasSearched = true;
        this.currentPage = 1;
        
        const searchParams = {
            origin: originCode,
            destination: destinationCode,
            departureFrom: this.departureFrom || null,
            departureTo: this.departureTo || null,
            weeks: this.weeks ? parseInt(this.weeks, 10) : null,
            limit: this.limit ? parseInt(this.limit, 10) : 100
        };
        
        console.log('Searching schedules with params:', JSON.stringify(searchParams));
        
        getSchedules({ searchParams: searchParams })
            .then(result => {
                console.log('Schedule search result:', JSON.stringify(result));
                console.log('Result type:', typeof result);
                console.log('Result keys:', result ? Object.keys(result) : 'null');
                
                if (result && typeof result === 'object') {
                    this.metadata = result.metadata || null;
                    
                    // Check for success flag
                    if (result.success === true || result.success === 'true') {
                        if (result.data && Array.isArray(result.data)) {
                            this.schedules = result.data;
                            console.log('Schedules found:', this.schedules.length);
                            this.extractUniqueValues();
                            this.applyFilters();
                            const count = this.schedules.length;
                            if (count > 0) {
                                this.showToast('Success', `Found ${count} schedule${count !== 1 ? 's' : ''}`, 'success');
                            } else {
                                this.showToast('Info', 'No schedules found for the selected criteria. Try adjusting your search dates or ports.', 'info');
                            }
                        } else {
                            this.schedules = [];
                            this.filteredSchedules = [];
                            this.totalRecords = 0;
                            console.log('No data array in response');
                            this.showToast('Info', 'No schedules found for the selected criteria', 'info');
                        }
                    } else if (result.data && Array.isArray(result.data)) {
                        // Some APIs return data without success flag
                        this.schedules = result.data;
                        this.extractUniqueValues();
                        this.applyFilters();
                        const count = this.schedules.length;
                        if (count > 0) {
                            this.showToast('Success', `Found ${count} schedule${count !== 1 ? 's' : ''}`, 'success');
                        } else {
                            this.showToast('Info', 'No schedules found', 'info');
                        }
                    } else {
                        this.schedules = [];
                        this.filteredSchedules = [];
                        this.totalRecords = 0;
                        const errorMsg = result.error || result.message || 'No schedules found';
                        console.log('No schedules found. Response:', JSON.stringify(result));
                        this.showToast('Info', errorMsg, 'info');
                    }
                } else {
                    this.schedules = [];
                    this.filteredSchedules = [];
                    this.totalRecords = 0;
                    console.error('Invalid response format:', result);
                    this.showToast('Error', 'Invalid response from server: ' + JSON.stringify(result), 'error');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching schedules:', error);
                console.error('Error body:', error.body);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                
                let errorMessage = 'Failed to load schedules';
                if (error.body) {
                    if (error.body.message) {
                        errorMessage = error.body.message;
                    } else if (error.body.pageErrors && error.body.pageErrors.length > 0) {
                        errorMessage = error.body.pageErrors[0].message;
                    } else if (error.body.fieldErrors) {
                        const fieldErrors = Object.values(error.body.fieldErrors);
                        if (fieldErrors.length > 0 && fieldErrors[0].length > 0) {
                            errorMessage = fieldErrors[0][0].message;
                        }
                    } else if (typeof error.body === 'string') {
                        errorMessage = error.body;
                    }
                } else if (error.message) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                }
                
                this.showToast('Error', errorMessage, 'error');
                this.isLoading = false;
                this.schedules = [];
                this.filteredSchedules = [];
                this.totalRecords = 0;
            });
    }
    
    extractUniqueValues() {
        const carriers = new Set();
        const services = new Set();
        const vessels = new Set();
        const voyages = new Set();
        
        this.schedules.forEach(schedule => {
            if (schedule.carrier) carriers.add(schedule.carrier);
            if (schedule.service_name) services.add(schedule.service_name);
            if (schedule.vessel_name) vessels.add(schedule.vessel_name);
            if (schedule.voyage) voyages.add(schedule.voyage);
        });
        
        this.uniqueCarriers = Array.from(carriers).sort();
        this.uniqueServices = Array.from(services).sort();
        this.uniqueVessels = Array.from(vessels).sort();
        this.uniqueVoyages = Array.from(voyages).sort();
        
        // Create options for comboboxes
        this.carrierOptions = [
            { label: 'All Carriers', value: '' },
            ...this.uniqueCarriers.map(carrier => ({ label: carrier, value: carrier }))
        ];
        
        this.serviceOptions = [
            { label: 'All Services', value: '' },
            ...this.uniqueServices.map(service => ({ label: service, value: service }))
        ];
        
        this.vesselOptions = [
            { label: 'All Vessels', value: '' },
            ...this.uniqueVessels.map(vessel => ({ label: vessel, value: vessel }))
        ];
        
        this.voyageOptions = [
            { label: 'All Voyages', value: '' },
            ...this.uniqueVoyages.map(voyage => ({ label: voyage, value: voyage }))
        ];
    }
    
    applyFilters() {
        let filtered = [...this.schedules];
        
        // Filter by carrier (exact match for picklist)
        if (this.filterCarrier) {
            filtered = filtered.filter(s => 
                s.carrier && s.carrier === this.filterCarrier
            );
        }
        
        // Filter by service (exact match for picklist)
        if (this.filterService) {
            filtered = filtered.filter(s => 
                s.service_name && s.service_name === this.filterService
            );
        }
        
        // Filter by vessel (exact match for picklist)
        if (this.filterVessel) {
            filtered = filtered.filter(s => 
                s.vessel_name && s.vessel_name === this.filterVessel
            );
        }
        
        // Filter by voyage (exact match for picklist)
        if (this.filterVoyage) {
            filtered = filtered.filter(s => 
                s.voyage && s.voyage === this.filterVoyage
            );
        }
        
        // Filter by direct only
        if (this.filterDirectOnly) {
            filtered = filtered.filter(s => s.is_direct === true);
        }
        
        // Filter by ETA from
        if (this.filterEtaFrom) {
            filtered = filtered.filter(s => {
                if (!s.eta) return false;
                const etaDate = new Date(s.eta);
                const filterDate = new Date(this.filterEtaFrom);
                return etaDate >= filterDate;
            });
        }
        
        // Filter by ETA to
        if (this.filterEtaTo) {
            filtered = filtered.filter(s => {
                if (!s.eta) return false;
                const etaDate = new Date(s.eta);
                const filterDate = new Date(this.filterEtaTo);
                filterDate.setHours(23, 59, 59, 999);
                return etaDate <= filterDate;
            });
        }
        
        // Sort
        filtered.sort((a, b) => {
            let aValue, bValue;
            
            switch (this.sortBy) {
                case 'etd':
                    aValue = a.etd ? new Date(a.etd).getTime() : 0;
                    bValue = b.etd ? new Date(b.etd).getTime() : 0;
                    break;
                case 'eta':
                    aValue = a.eta ? new Date(a.eta).getTime() : 0;
                    bValue = b.eta ? new Date(b.eta).getTime() : 0;
                    break;
                case 'transit_time_days':
                    aValue = a.transit_time_days || 0;
                    bValue = b.transit_time_days || 0;
                    break;
                default:
                    aValue = 0;
                    bValue = 0;
            }
            
            if (this.sortDirection === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        });
        
        this.filteredSchedules = filtered;
        this.totalRecords = filtered.length;
        this.currentPage = 1;
    }
    
    handleClearFilters() {
        this.filterCarrier = '';
        this.filterService = '';
        this.filterVessel = '';
        this.filterVoyage = '';
        this.filterDirectOnly = false;
        this.filterEtaFrom = '';
        this.filterEtaTo = '';
        this.applyFilters();
    }
    
    handleClearSearch() {
        this.origin = '';
        this.destination = '';
        this.departureFrom = new Date().toISOString().split('T')[0];
        this.departureTo = '';
        this.weeks = 4;
        this.limit = 100;
        this.schedules = [];
        this.filteredSchedules = [];
        this.totalRecords = 0;
        this.hasSearched = false;
        this.metadata = null;
        this.handleClearFilters();
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
    
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch (e) {
            return dateString;
        }
    }
    
    formatDateTime(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }
    
    formatDateShort(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }
    
    get paginatedSchedules() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredSchedules.slice(start, end);
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
    
    get showingResults() {
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalRecords);
        return `Showing ${start}-${end} of ${this.totalRecords} schedules`;
    }
    
    get hasResults() {
        return this.filteredSchedules.length > 0;
    }
    
    get sortIndicatorEtd() {
        if (this.sortBy === 'etd') {
            return this.sortDirection === 'asc' ? '↑' : '↓';
        }
        return '';
    }
    
    get sortIndicatorEta() {
        if (this.sortBy === 'eta') {
            return this.sortDirection === 'asc' ? '↑' : '↓';
        }
        return '';
    }
    
    get sortIndicatorTransit() {
        if (this.sortBy === 'transit_time_days') {
            return this.sortDirection === 'asc' ? '↑' : '↓';
        }
        return '';
    }
    
    get disablePreviousPage() {
        return !this.hasPreviousPage;
    }
    
    get disableNextPage() {
        return !this.hasNextPage;
    }
    
    // Format schedule dates for display
    get formattedSchedules() {
        if (!this.paginatedSchedules || this.paginatedSchedules.length === 0) {
            return [];
        }
        return this.paginatedSchedules.map((schedule, index) => {
            return Object.assign({}, schedule, {
                formattedEtd: this.formatDateShort(schedule.etd),
                formattedEta: this.formatDateShort(schedule.eta),
                uniqueKey: (schedule.etd || '') + '-' + (schedule.voyage || '') + '-' + index,
                carrierLogoUrl: this.getCarrierLogo(schedule.carrier)
            });
        });
    }
    
    handleViewRouteDetails(event) {
        const scheduleIndex = parseInt(event.currentTarget.dataset.index, 10);
        const schedule = this.paginatedSchedules[scheduleIndex];
        if (schedule && schedule.legs && schedule.legs.length > 0) {
            // Add formatted dates and logo to selected schedule
            this.selectedSchedule = {
                ...schedule,
                formattedEtd: this.formatDateShort(schedule.etd),
                formattedEta: this.formatDateShort(schedule.eta),
                carrierLogoUrl: this.getCarrierLogo(schedule.carrier)
            };
            this.showRouteDetailsModal = true;
        }
    }
    
    handleCloseRouteDetails() {
        this.showRouteDetailsModal = false;
        this.selectedSchedule = null;
    }
    
    get hasRouteDetails() {
        return this.selectedSchedule && this.selectedSchedule.legs && this.selectedSchedule.legs.length > 0;
    }
    
    get routeLegs() {
        if (!this.selectedSchedule || !this.selectedSchedule.legs) {
            return [];
        }
        return this.selectedSchedule.legs.map((leg, index) => {
            const prevLeg = index > 0 ? this.selectedSchedule.legs[index - 1] : null;
            const nextLeg = index < this.selectedSchedule.legs.length - 1 ? this.selectedSchedule.legs[index + 1] : null;
            
            // Transshipment port: when this leg's destination matches next leg's origin and both are VESSEL
            // The green dot should appear at the arrival of this leg if next leg is transshipment
            const isTransshipmentArrival = nextLeg && leg.to === nextLeg.from && leg.transport_mode === 'VESSEL' && nextLeg.transport_mode === 'VESSEL';
            
            return {
                ...leg,
                index: index + 1,
                formattedDeparture: this.formatDateTime(leg.departure),
                formattedArrival: this.formatDateTime(leg.arrival),
                transportIcon: this.getTransportIcon(leg.transport_mode),
                isFirst: index === 0,
                isLast: index === this.selectedSchedule.legs.length - 1,
                isTransshipment: isTransshipmentArrival
            };
        });
    }
    
    handleVesselClick(event) {
        event.preventDefault();
        // Could navigate to vessel details or show more info
    }
    
    getTransportIcon(transportMode) {
        switch (transportMode) {
            case 'VESSEL':
                return 'standard:ship';
            case 'RAIL':
                return 'standard:train';
            case 'TRUCK':
                return 'standard:car';
            case 'BARGE':
                return 'standard:ship';
            default:
                return 'standard:location';
        }
    }
    
    handleCreateEnquiry(event) {
        // Get the schedule data from the button's dataset or event
        const scheduleIndex = parseInt(event.currentTarget.dataset.index, 10);
        const schedule = this.formattedSchedules[scheduleIndex];
        
        if (!schedule) {
            this.showToast('Error', 'Schedule not found', 'error');
            return;
        }
        
        // Dispatch custom event to parent or navigate to enquiry creation
        const evt = new CustomEvent('createenquiry', {
            detail: { 
                schedule: schedule,
                origin: schedule.origin_port_code,
                destination: schedule.destination_port_code,
                carrier: schedule.carrier,
                vessel: schedule.vessel_name,
                voyage: schedule.voyage,
                etd: schedule.etd,
                eta: schedule.eta,
                transitDays: schedule.transit_time_days
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(evt);
        
        // For now, show a toast
        this.showToast('Info', `Creating enquiry for ${schedule.carrier} - ${schedule.vessel_name}`, 'info');
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

