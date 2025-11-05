import type { DCSAScheduleMessage } from '../../types/dcsa.types.js';
import type { UpsertDcsaSchedulePayload, PortCallPayload } from '../../types/schedule-database.types.js';

/**
 * Transform DCSA schedule message to database upsert payload
 */
export class DCSATransformer {
  /**
   * Transform DCSA schedule message to database format
   */
  static transformToDatabasePayload(
    dcsaMessage: DCSAScheduleMessage
  ): UpsertDcsaSchedulePayload {
    const portCalls: PortCallPayload[] = dcsaMessage.portCalls.map((pc) => {
      const times: Record<string, string> = {};

      if (pc.times) {
        if (pc.times.plannedArrival) {
          times.plannedArrival = pc.times.plannedArrival;
        }
        if (pc.times.plannedDeparture) {
          times.plannedDeparture = pc.times.plannedDeparture;
        }
        if (pc.times.estimatedArrival) {
          times.estimatedArrival = pc.times.estimatedArrival;
        }
        if (pc.times.estimatedDeparture) {
          times.estimatedDeparture = pc.times.estimatedDeparture;
        }
        if (pc.times.actualArrival) {
          times.actualArrival = pc.times.actualArrival;
        }
        if (pc.times.actualDeparture) {
          times.actualDeparture = pc.times.actualDeparture;
        }
      }

      return {
        unlocode: pc.unlocode,
        sequence: pc.sequence,
        facilitySMDG: pc.facilitySMDG,
        facilityName: pc.facilityName,
        carrierImportVoyageNumber: pc.carrierImportVoyageNumber,
        carrierExportVoyageNumber: pc.carrierExportVoyageNumber,
        universalImportVoyageReference: pc.universalImportVoyageReference,
        universalExportVoyageReference: pc.universalExportVoyageReference,
        statusCode: pc.statusCode,
        transportCallReference: pc.transportCallReference,
        times: Object.keys(times).length > 0 ? times : undefined,
      };
    });

    return {
      carrierName: dcsaMessage.carrierName,
      carrierServiceCode: dcsaMessage.carrierServiceCode,
      serviceName: dcsaMessage.serviceName,
      carrierVoyageNumber: dcsaMessage.carrierVoyageNumber,
      vesselIMO: dcsaMessage.vesselIMO,
      vesselName: dcsaMessage.vesselName,
      source: dcsaMessage.source || 'DCSA',
      portCalls,
    };
  }
}


