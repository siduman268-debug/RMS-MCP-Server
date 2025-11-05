/**
 * DCSA (Digital Container Shipping Association) API Types
 * Based on DCSA standard specifications
 */

// ============================================================================
// DCSA Schedule Message Types
// ============================================================================

export interface DCSAScheduleMessage {
  carrierName: string;
  carrierServiceCode: string;
  serviceName?: string;
  carrierVoyageNumber: string;
  vesselIMO: string;
  vesselName: string;
  source?: string;
  portCalls: DCSAPortCall[];
}

export interface DCSAPortCall {
  unlocode: string;
  sequence: number;
  facilitySMDG?: string;
  facilityName?: string;
  carrierImportVoyageNumber?: string;
  carrierExportVoyageNumber?: string;
  universalImportVoyageReference?: string;
  universalExportVoyageReference?: string;
  statusCode?: string;
  transportCallReference?: string;
  times?: DCSAPortCallTimes;
}

export interface DCSAPortCallTimes {
  plannedArrival?: string; // ISO 8601 timestamp
  plannedDeparture?: string; // ISO 8601 timestamp
  estimatedArrival?: string; // ISO 8601 timestamp
  estimatedDeparture?: string; // ISO 8601 timestamp
  actualArrival?: string; // ISO 8601 timestamp
  actualDeparture?: string; // ISO 8601 timestamp
}

// ============================================================================
// DCSA API Response Types
// ============================================================================

export interface DCSAApiResponse<T> {
  data: T;
  pagination?: {
    cursor?: string;
    limit?: number;
    total?: number;
  };
}

export interface DCSAScheduleResponse {
  scheduleId: string;
  carrierName: string;
  carrierServiceCode: string;
  serviceName?: string;
  carrierVoyageNumber: string;
  vessel: {
    imo: string;
    name: string;
  };
  portCalls: DCSAPortCall[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// DCSA Webhook Types
// ============================================================================

export interface DCSAWebhookPayload {
  eventType: 'SCHEDULE_UPDATED' | 'SCHEDULE_CREATED' | 'SCHEDULE_DELETED';
  schedule: DCSAScheduleMessage;
  timestamp: string;
  carrierId?: string;
}

// ============================================================================
// Carrier-Specific DCSA Adapters
// ============================================================================

export interface CarrierDCSAAdapter {
  /**
   * Fetch schedules from carrier's DCSA-compliant API
   */
  fetchSchedules(params: {
    carrierServiceCode?: string;
    voyageNumber?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<DCSAScheduleMessage[]>;

  /**
   * Transform carrier-specific format to DCSA standard
   */
  transformToDCSA(data: unknown): DCSAScheduleMessage;
}

