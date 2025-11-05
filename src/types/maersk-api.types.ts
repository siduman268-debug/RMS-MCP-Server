/**
 * Maersk API Response Types
 * Based on actual Maersk API response structures
 */

// ============================================================================
// Point-to-Point API Response Types
// ============================================================================

export interface MaerskPointToPointResponse {
  placeOfReceipt: MaerskLocationWithDateTime;
  placeOfDelivery: MaerskLocationWithDateTime;
  receiptTypeAtOrigin: 'CY' | 'CFS' | 'DOOR';
  deliveryTypeAtDestination: 'CY' | 'CFS' | 'DOOR';
  solutionNumber: number;
  routingReference: string;
  transitTime: number;
  legs: MaerskLeg[];
}

export interface MaerskLocationWithDateTime {
  facilityTypeCode: string;
  location: MaerskLocation;
  dateTime: string; // ISO 8601 format
}

export interface MaerskLocation {
  locationName: string;
  UNLocationCode: string;
  facility?: MaerskFacility;
}

export interface MaerskFacility {
  facilityCode: string;
  facilityCodeListProvider: 'SMDG' | 'BIC' | 'UNLOCODE';
}

export interface MaerskLeg {
  sequenceNumber: number;
  transport: MaerskTransport;
  departure: MaerskLocationWithDateTime;
  arrival: MaerskLocationWithDateTime;
}

export interface MaerskTransport {
  modeOfTransport: 'VESSEL' | 'RAIL' | 'TRUCK' | 'BARGE';
  servicePartners: MaerskServicePartner[];
  vessel: MaerskVesselInfo;
}

export interface MaerskServicePartner {
  carrierCode: string;
  carrierCodeListProvider: 'NMFTA' | 'SMDG' | 'BIC';
  carrierServiceName: string;
  carrierServiceCode: string;
  carrierImportVoyageNumber: string;
  carrierExportVoyageNumber: string;
}

export interface MaerskVesselInfo {
  vesselIMONumber: string;
  name: string;
  flag: string;
  callSign: string;
}

// ============================================================================
// Vessel Schedule API Response Types
// ============================================================================

export interface MaerskVesselScheduleResponse {
  carrierServiceName: string;
  carrierServiceCode: string;
  vesselSchedules: MaerskVesselSchedule[];
}

export interface MaerskVesselSchedule {
  vessel: MaerskVesselDetails;
  isDummyVessel: boolean;
  transportCalls: MaerskTransportCall[];
}

export interface MaerskVesselDetails {
  vesselIMONumber: string;
  name: string;
  flag: string;
  callSign: string;
  operatorCarrierCode: string;
  operatorCarrierCodeListProvider: 'SMDG' | 'BIC' | 'NMFTA';
}

export interface MaerskTransportCall {
  transportCallReference: string;
  carrierImportVoyageNumber: string;
  carrierExportVoyageNumber: string;
  location: MaerskTransportCallLocation;
  timestamps: MaerskTimestamp[];
}

export interface MaerskTransportCallLocation {
  locationName: string;
  UNLocationCode: string;
  facilitySMDGCode?: string;
}

export interface MaerskTimestamp {
  eventTypeCode: 'ARRI' | 'DEPA'; // ARRIVAL or DEPARTURE
  eventClassifierCode: 'EST' | 'ACT' | 'PLN'; // ESTIMATED, ACTUAL, PLANNED
  eventDateTime: string; // ISO 8601 format
}

// ============================================================================
// Port/Location API Response Types
// ============================================================================

export interface MaerskPortScheduleResponse {
  UNLocationCode: string;
  portSchedules?: Array<{
    carrierServiceCode?: string;
    carrierServiceName?: string;
    vessel?: {
      vesselIMONumber?: string;
      name?: string;
    };
    transportCalls?: MaerskTransportCall[];
    date?: string;
  }>;
}

export interface MaerskPortResponse {
  locationName: string;
  UNLocationCode: string;
  locationType?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  countryCode?: string;
  timezone?: string;
  facilities?: MaerskPortFacility[];
}

export interface MaerskPortFacility {
  facilityCode: string;
  facilityName: string;
  facilityCodeListProvider: 'SMDG' | 'BIC' | 'UNLOCODE';
  facilityTypeCode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// ============================================================================
// API Wrapper Types
// ============================================================================

export interface MaerskApiResponse<T> {
  data: T[];
  pagination?: {
    page?: number;
    pageSize?: number;
    totalPages?: number;
    totalRecords?: number;
    nextCursor?: string;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

// ============================================================================
// Request Parameter Types
// ============================================================================

export interface MaerskPointToPointRequest {
  origin: string; // UNLocationCode
  destination: string; // UNLocationCode
  cargoType?: string;
  containerType?: string;
  fromDate?: string; // ISO 8601 date
  toDate?: string; // ISO 8601 date
  limit?: number;
}

export interface MaerskVesselScheduleRequest {
  carrierServiceCode?: string;
  vesselIMONumber?: string;
  fromDate?: string; // ISO 8601 date
  toDate?: string; // ISO 8601 date
  limit?: number;
  cursor?: string;
}

export interface MaerskPortScheduleRequest {
  UNLocationCode: string; // Required
  date: string; // ISO 8601 date (required)
}

export interface MaerskPortRequest {
  UNLocationCode?: string;
  countryCode?: string;
  search?: string; // Search by name or code
  limit?: number;
}

// ============================================================================
// Service Discovery Types
// ============================================================================

export interface MaerskService {
  carrierServiceCode: string;
  carrierServiceName: string;
}

