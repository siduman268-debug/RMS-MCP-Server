import axios from 'axios';
import { BaseDCSAAdapter } from './base.adapter.js';
import type { CarrierDCSAAdapter, DCSAScheduleMessage } from '../../types/dcsa.types.js';
import type {
  MaerskVesselScheduleResponse,
  MaerskPointToPointResponse,
  MaerskPortScheduleResponse,
  MaerskTransportCall,
  MaerskTimestamp,
} from '../../types/maersk-api.types.js';

/**
 * Maersk DCSA API Adapter
 */
export class MaerskDCSAAdapter extends BaseDCSAAdapter {
  /**
   * Fetch schedules from Maersk Vessel Schedule API
   */
  async fetchSchedules(params: {
    carrierServiceCode?: string;
    voyageNumber?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<DCSAScheduleMessage[]> {
    try {
      // Build authentication headers - Maersk uses Consumer-Key header
      const headers: Record<string, string> = {
        'Consumer-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Fetch vessel schedules from Maersk API
      // Endpoint: /ocean/commercial-schedules/dcsa/v1/vessel-schedules
      const response = await axios.get<MaerskVesselScheduleResponse[]>(
        `${this.apiBaseUrl}/ocean/commercial-schedules/dcsa/v1/vessel-schedules`,
        {
          headers,
          params: {
            carrierServiceCode: params.carrierServiceCode,
            fromDate: params.fromDate,
            toDate: params.toDate,
            limit: params.limit || 100,
            cursor: params.cursor,
          },
        }
      );

      // Transform each vessel schedule to DCSA format
      const schedules: DCSAScheduleMessage[] = [];

      for (const vesselScheduleResponse of response.data) {
        for (const vesselSchedule of vesselScheduleResponse.vesselSchedules) {
          // Group transport calls by voyage number (export voyage)
          const voyageGroups = new Map<string, MaerskTransportCall[]>();

          for (const transportCall of vesselSchedule.transportCalls) {
            const voyageKey = transportCall.carrierExportVoyageNumber;
            if (!voyageGroups.has(voyageKey)) {
              voyageGroups.set(voyageKey, []);
            }
            voyageGroups.get(voyageKey)!.push(transportCall);
          }

          // Create a DCSA schedule for each voyage
          for (const [voyageNumber, transportCalls] of voyageGroups) {
            const schedule = this.transformVesselScheduleToDCSA(
              vesselScheduleResponse,
              vesselSchedule,
              transportCalls,
              voyageNumber
            );
            schedules.push(schedule);
          }
        }
      }

      // Filter by voyage number if specified
      if (params.voyageNumber) {
        return schedules.filter(
          (s) => s.carrierVoyageNumber === params.voyageNumber
        );
      }

      return schedules;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Maersk API error: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Transform Maersk vessel schedule response to DCSA format
   */
  transformToDCSA(data: unknown): DCSAScheduleMessage {
    // This method is called for individual schedules
    // For vessel schedules, use transformVesselScheduleToDCSA
    const schedule = data as {
      carrierServiceName: string;
      carrierServiceCode: string;
      vesselSchedules: Array<{
        vessel: {
          vesselIMONumber: string;
          name: string;
        };
        transportCalls: MaerskTransportCall[];
      }>;
    };

    if (!schedule.vesselSchedules || schedule.vesselSchedules.length === 0) {
      throw new Error('Invalid Maersk schedule data: no vessel schedules');
    }

    const vesselSchedule = schedule.vesselSchedules[0];
    const transportCalls = vesselSchedule.transportCalls;

    // Use the first export voyage number as the voyage identifier
    const voyageNumber = transportCalls[0]?.carrierExportVoyageNumber || '';

    return this.transformVesselScheduleToDCSA(
      schedule,
      vesselSchedule,
      transportCalls,
      voyageNumber
    );
  }

  /**
   * Transform Maersk vessel schedule to DCSA schedule message
   */
  private transformVesselScheduleToDCSA(
    serviceResponse: { carrierServiceName: string; carrierServiceCode: string },
    vesselSchedule: {
      vessel: {
        vesselIMONumber: string;
        name: string;
      };
      transportCalls: MaerskTransportCall[];
    },
    transportCalls: MaerskTransportCall[],
    voyageNumber: string
  ): DCSAScheduleMessage {
    // Sort transport calls by sequence (derive from timestamps or use array index)
    const sortedCalls = [...transportCalls].sort((a, b) => {
      const aTime = a.timestamps[0]?.eventDateTime || '';
      const bTime = b.timestamps[0]?.eventDateTime || '';
      return aTime.localeCompare(bTime);
    });

    // Transform transport calls to port calls
    const portCalls = sortedCalls.map((tc, index) => {
      const times = this.extractTimesFromTimestamps(tc.timestamps);

      return {
        unlocode: tc.location.UNLocationCode,
        sequence: index + 1,
        facilitySMDG: tc.location.facilitySMDGCode,
        facilityName: tc.location.locationName,
        carrierImportVoyageNumber: tc.carrierImportVoyageNumber,
        carrierExportVoyageNumber: tc.carrierExportVoyageNumber,
        transportCallReference: tc.transportCallReference,
        times,
      };
    });

    return {
      carrierName: 'MAERSK',
      carrierServiceCode: serviceResponse.carrierServiceCode,
      serviceName: serviceResponse.carrierServiceName,
      carrierVoyageNumber: voyageNumber,
      vesselIMO: vesselSchedule.vessel.vesselIMONumber,
      vesselName: vesselSchedule.vessel.name,
      source: 'MAERSK',
      portCalls,
    };
  }

  /**
   * Extract times from Maersk timestamp array
   */
  private extractTimesFromTimestamps(
    timestamps: MaerskTimestamp[]
  ): {
    plannedArrival?: string;
    plannedDeparture?: string;
    estimatedArrival?: string;
    estimatedDeparture?: string;
    actualArrival?: string;
    actualDeparture?: string;
  } {
    const times: {
      plannedArrival?: string;
      plannedDeparture?: string;
      estimatedArrival?: string;
      estimatedDeparture?: string;
      actualArrival?: string;
      actualDeparture?: string;
    } = {};

    for (const ts of timestamps) {
      const isArrival = ts.eventTypeCode === 'ARRI';
      const isDeparture = ts.eventTypeCode === 'DEPA';

      if (isArrival && ts.eventClassifierCode === 'PLN') {
        times.plannedArrival = ts.eventDateTime;
      } else if (isArrival && ts.eventClassifierCode === 'EST') {
        times.estimatedArrival = ts.eventDateTime;
      } else if (isArrival && ts.eventClassifierCode === 'ACT') {
        times.actualArrival = ts.eventDateTime;
      } else if (isDeparture && ts.eventClassifierCode === 'PLN') {
        times.plannedDeparture = ts.eventDateTime;
      } else if (isDeparture && ts.eventClassifierCode === 'EST') {
        times.estimatedDeparture = ts.eventDateTime;
      } else if (isDeparture && ts.eventClassifierCode === 'ACT') {
        times.actualDeparture = ts.eventDateTime;
      }
    }

    return times;
  }

  /**
   * Fetch point-to-point routes
   * Endpoint: /ocean/commercial-schedules/dcsa/v1/point-to-point-routes
   */
  async fetchPointToPoint(
    placeOfReceipt: string,
    placeOfDelivery: string,
    params?: {
      fromDate?: string;
      toDate?: string;
      limit?: number;
    }
  ): Promise<MaerskPointToPointResponse[]> {
    try {
      // Build authentication headers - Maersk uses Consumer-Key header
      const headers: Record<string, string> = {
        'Consumer-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Fetch point-to-point routes from Maersk API
      // Endpoint: /ocean/commercial-schedules/dcsa/v1/point-to-point-routes
      const response = await axios.get<MaerskPointToPointResponse[]>(
        `${this.apiBaseUrl}/ocean/commercial-schedules/dcsa/v1/point-to-point-routes`,
        {
          headers,
          params: {
            placeOfReceipt,
            placeOfDelivery,
            fromDate: params?.fromDate,
            toDate: params?.toDate,
            limit: params?.limit || 10,
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Maersk Point-to-Point API error: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Discover available services from Maersk API
   * Fetches schedules without service code filter to discover all services
   */
  async discoverServices(params?: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<Array<{ carrierServiceCode: string; carrierServiceName: string }>> {
    try {
      // Build authentication headers - Maersk uses Consumer-Key header
      const headers: Record<string, string> = {
        'Consumer-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Fetch schedules without service code filter to discover all services
      // Endpoint: /ocean/commercial-schedules/dcsa/v1/vessel-schedules
      const response = await axios.get<MaerskVesselScheduleResponse[]>(
        `${this.apiBaseUrl}/ocean/commercial-schedules/dcsa/v1/vessel-schedules`,
        {
          headers,
          params: {
            // Don't include carrierServiceCode - fetch all to discover services
            fromDate: params?.fromDate,
            toDate: params?.toDate,
            limit: params?.limit || 1000, // Get more results to discover all services
          },
        }
      );

      // Extract unique services from response
      const serviceMap = new Map<string, { carrierServiceCode: string; carrierServiceName: string }>();

      for (const scheduleResponse of response.data) {
        const serviceCode = scheduleResponse.carrierServiceCode;
        const serviceName = scheduleResponse.carrierServiceName;

        if (!serviceMap.has(serviceCode)) {
          serviceMap.set(serviceCode, {
            carrierServiceCode: serviceCode,
            carrierServiceName: serviceName,
          });
        }
      }

      return Array.from(serviceMap.values());
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Maersk service discovery error: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Fetch port schedules for a specific location and date
   * Endpoint: /ocean/commercial-schedules/dcsa/v1/port-schedules
   */
  async fetchPortSchedules(
    UNLocationCode: string,
    date: string
  ): Promise<MaerskPortScheduleResponse> {
    try {
      // Build authentication headers - Maersk uses Consumer-Key header
      const headers: Record<string, string> = {
        'Consumer-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      // Fetch port schedules from Maersk API
      // Endpoint: /ocean/commercial-schedules/dcsa/v1/port-schedules
      const response = await axios.get<MaerskPortScheduleResponse>(
        `${this.apiBaseUrl}/ocean/commercial-schedules/dcsa/v1/port-schedules`,
        {
          headers,
          params: {
            UNLocationCode,
            date,
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Maersk Port Schedule API error: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }
}

