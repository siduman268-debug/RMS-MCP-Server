/**
 * Schedule Database Types
 * Types for DCSA schedule upsert operations
 */

export interface UpsertDcsaSchedulePayload {
  carrierName: string;
  carrierServiceCode: string;
  serviceName?: string;
  carrierVoyageNumber: string;
  vesselIMO: string;
  vesselName: string;
  source?: string;
  portCalls?: PortCallPayload[];
}

export interface PortCallPayload {
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
  times?: {
    plannedArrival?: string;
    plannedDeparture?: string;
    estimatedArrival?: string;
    estimatedDeparture?: string;
    actualArrival?: string;
    actualDeparture?: string;
  };
}


