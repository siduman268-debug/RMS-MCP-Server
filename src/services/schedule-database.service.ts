/**
 * Schedule Database Service - Adapted for rms-mcp-server
 * Uses the existing supabase client instead of creating a new one
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UpsertDcsaSchedulePayload, PortCallPayload } from '../types/schedule-database.types.js';

/**
 * Database service for schedule operations
 * Uses the existing supabase client from rms-mcp-server
 */
export class ScheduleDatabaseService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upsert DCSA schedule using direct table inserts (bypasses RPC function)
   */
  async upsertDcsaSchedule(payload: UpsertDcsaSchedulePayload): Promise<void> {
    // Normalize payload: remove undefined, convert dates, ensure clean structure
    const normalizeValue = (value: unknown): unknown => {
      if (value === undefined) {
        return null;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Array.isArray(value)) {
        return value.map(normalizeValue);
      }
      if (value && typeof value === 'object') {
        const normalized: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          normalized[key] = normalizeValue(val);
        }
        return normalized;
      }
      return value;
    };

    const cleanPayload = normalizeValue(payload) as UpsertDcsaSchedulePayload;

    // Ensure required fields exist
    if (!cleanPayload.carrierName) {
      throw new Error('Missing required field: carrierName');
    }
    if (!cleanPayload.carrierServiceCode) {
      throw new Error('Missing required field: carrierServiceCode');
    }
    if (!cleanPayload.carrierVoyageNumber) {
      throw new Error('Missing required field: carrierVoyageNumber');
    }

    try {
      // 1. Upsert carrier
      const { data: carrierData, error: carrierError } = await this.supabase
        .from('schedules.carrier')
        .upsert({ name: cleanPayload.carrierName }, { onConflict: 'name', ignoreDuplicates: true })
        .select('id')
        .single();

      if (carrierError && !carrierError.message.includes('duplicate') && !carrierError.message.includes('violates unique')) {
        throw new Error(`Failed to upsert carrier: ${carrierError.message}`);
      }

      // Get carrier ID (either from insert or existing)
      let carrierId: string;
      if (carrierData?.id) {
        carrierId = carrierData.id;
      } else {
        const { data: existingCarrier, error: fetchError } = await this.supabase
          .from('schedules.carrier')
          .select('id')
          .eq('name', cleanPayload.carrierName)
          .single();
        
        if (fetchError || !existingCarrier) {
          throw new Error(`Failed to get carrier ID: ${fetchError?.message || 'Carrier not found'}`);
        }
        carrierId = existingCarrier.id;
      }

      // 2. Upsert vessel
      const { data: vesselData, error: vesselError } = await this.supabase
        .from('schedules.vessel')
        .upsert(
          { imo: cleanPayload.vesselIMO, name: cleanPayload.vesselName },
          { onConflict: 'imo' }
        )
        .select('id')
        .single();

      if (vesselError) {
        throw new Error(`Failed to upsert vessel: ${vesselError.message}`);
      }
      const vesselId = vesselData!.id;

      // 3. Upsert service
      const { data: serviceData, error: serviceError } = await this.supabase
        .from('schedules.service')
        .upsert(
          {
            carrier_id: carrierId,
            carrier_service_code: cleanPayload.carrierServiceCode,
            carrier_service_name: cleanPayload.serviceName || null,
          },
          { onConflict: 'carrier_id,carrier_service_code' }
        )
        .select('id')
        .single();

      if (serviceError) {
        throw new Error(`Failed to upsert service: ${serviceError.message}`);
      }
      const serviceId = serviceData!.id;

      // 4. Upsert voyage
      const { data: voyageData, error: voyageError } = await this.supabase
        .from('schedules.voyage')
        .upsert(
          {
            service_id: serviceId,
            carrier_voyage_number: cleanPayload.carrierVoyageNumber,
            vessel_id: vesselId,
          },
          { onConflict: 'service_id,carrier_voyage_number' }
        )
        .select('id')
        .single();

      if (voyageError && !voyageError.message.includes('duplicate')) {
        throw new Error(`Failed to upsert voyage: ${voyageError.message}`);
      }

      // Get voyage ID (might be existing or new)
      let voyageId: string;
      if (voyageData?.id) {
        voyageId = voyageData.id;
      } else {
        const { data: existingVoyage, error: fetchVoyageError } = await this.supabase
          .from('schedules.voyage')
          .select('id')
          .eq('service_id', serviceId)
          .eq('carrier_voyage_number', cleanPayload.carrierVoyageNumber)
          .single();
        
        if (fetchVoyageError || !existingVoyage) {
          throw new Error(`Failed to get voyage ID: ${fetchVoyageError?.message || 'Voyage not found'}`);
        }
        voyageId = existingVoyage.id;
      }

      // 5. Process port calls
      if (cleanPayload.portCalls && cleanPayload.portCalls.length > 0) {
        for (const portCall of cleanPayload.portCalls) {
          await this.processPortCall(portCall, voyageId);
        }
      }

      // 6. Insert audit record
      const { error: auditError } = await this.supabase
        .from('schedules.schedule_source_audit')
        .insert({
          carrier_id: carrierId,
          source_system: cleanPayload.source || 'UNKNOWN',
          raw_payload: cleanPayload as any,
        });

      if (auditError) {
        console.warn('Failed to insert audit record:', auditError.message);
        // Don't throw - audit is non-critical
      }
    } catch (error) {
      console.error('Error upserting DCSA schedule:', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Process a single port call
   */
  private async processPortCall(portCall: PortCallPayload, voyageId: string): Promise<void> {
    // Get location ID from unlocode
    const { data: locationData, error: locationError } = await this.supabase
      .from('locations')
      .select('id')
      .eq('unlocode', portCall.unlocode)
      .limit(1)
      .single();

    if (locationError || !locationData) {
      console.warn(`UNLOCODE ${portCall.unlocode} not found in locations; skipping port call`);
      return;
    }
    const locationId = locationData.id;

    // Upsert facility if SMDG code provided
    let facilityId: string | null = null;
    if (portCall.facilitySMDG) {
      const { data: facilityData, error: facilityError } = await this.supabase
        .from('schedules.facility')
        .upsert(
          {
            smdg_code: portCall.facilitySMDG,
            name: portCall.facilityName || null,
            location_id: locationId,
          },
          { onConflict: 'smdg_code,location_id' }
        )
        .select('id')
        .single();

      if (!facilityError && facilityData) {
        facilityId = facilityData.id;
      } else if (facilityError && !facilityError.message.includes('duplicate')) {
        // If facility exists, fetch it
        const { data: existingFacility } = await this.supabase
          .from('schedules.facility')
          .select('id')
          .eq('smdg_code', portCall.facilitySMDG)
          .eq('location_id', locationId)
          .single();
        
        if (existingFacility) {
          facilityId = existingFacility.id;
        }
      }
    }

    // Upsert transport call
    const { data: transportCallData, error: transportCallError } = await this.supabase
      .from('schedules.transport_call')
      .upsert(
        {
          voyage_id: voyageId,
          sequence_no: portCall.sequence,
          location_id: locationId,
          facility_id: facilityId,
          carrier_import_voyage_number: portCall.carrierImportVoyageNumber || null,
          carrier_export_voyage_number: portCall.carrierExportVoyageNumber || null,
          universal_import_voyage_reference: portCall.universalImportVoyageReference || null,
          universal_export_voyage_reference: portCall.universalExportVoyageReference || null,
          status_code: portCall.statusCode || null,
          transport_call_reference: portCall.transportCallReference || null,
        },
        { onConflict: 'voyage_id,sequence_no' }
      )
      .select('id')
      .single();

    let transportCallId: string;
    if (transportCallData?.id) {
      transportCallId = transportCallData.id;
    } else {
      const { data: existingTransportCall } = await this.supabase
        .from('schedules.transport_call')
        .select('id')
        .eq('voyage_id', voyageId)
        .eq('sequence_no', portCall.sequence)
        .single();
      
      if (!existingTransportCall) {
        throw new Error(`Failed to get transport call ID for sequence ${portCall.sequence}`);
      }
      transportCallId = existingTransportCall.id;
    }

    // Insert port call times
    if (portCall.times) {
      const timeEntries = [
        { key: 'plannedArrival', eventType: 'ARRIVAL', timeKind: 'PLANNED' },
        { key: 'plannedDeparture', eventType: 'DEPARTURE', timeKind: 'PLANNED' },
        { key: 'estimatedArrival', eventType: 'ARRIVAL', timeKind: 'ESTIMATED' },
        { key: 'estimatedDeparture', eventType: 'DEPARTURE', timeKind: 'ESTIMATED' },
        { key: 'actualArrival', eventType: 'ARRIVAL', timeKind: 'ACTUAL' },
        { key: 'actualDeparture', eventType: 'DEPARTURE', timeKind: 'ACTUAL' },
      ];

      for (const { key, eventType, timeKind } of timeEntries) {
        const timeValue = portCall.times[key as keyof typeof portCall.times];
        if (timeValue) {
          await this.supabase
            .from('schedules.port_call_time')
            .upsert(
              {
                transport_call_id: transportCallId,
                event_type: eventType,
                time_kind: timeKind,
                event_datetime: timeValue,
              },
              { onConflict: 'transport_call_id,event_type,time_kind' }
            );
        }
      }
    }
  }

  /**
   * Get next departures for a specific origin
   */
  async getNextDepartures(originLocationId: string, limit = 10) {
    const { data, error } = await this.supabase
      .from('v_next_departures')
      .select('*')
      .eq('origin_location_id', originLocationId)
      .order('etd', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get next departures: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get port calls for a voyage
   */
  async getPortCalls(voyageId: string) {
    const { data, error } = await this.supabase
      .from('v_port_calls')
      .select('*')
      .eq('voyage_id', voyageId)
      .order('sequence_no', { ascending: true });

    if (error) {
      throw new Error(`Failed to get port calls: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get destination ETA for a voyage and destination
   */
  async getDestinationETA(voyageId: string, destinationLocationId: string) {
    const { data, error } = await this.supabase
      .from('v_dest_eta')
      .select('*')
      .eq('voyage_id', voyageId)
      .eq('destination_location_id', destinationLocationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get destination ETA: ${error.message}`);
    }

    return data;
  }

  /**
   * Get rates with next sailing
   */
  async getRatesWithNextSailing(params: {
    polId?: string;
    podId?: string;
    carrier?: string;
    containerType?: string;
    limit?: number;
  }) {
    let query = this.supabase.from('v_rates_with_next_sailing').select('*');

    if (params.polId) {
      query = query.eq('pol_id', params.polId);
    }

    if (params.podId) {
      query = query.eq('pod_id', params.podId);
    }

    if (params.carrier) {
      query = query.ilike('carrier', params.carrier);
    }

    if (params.containerType) {
      query = query.eq('container_type', params.containerType);
    }

    query = query.order('next_etd', { ascending: true, nullsFirst: false });

    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get rates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all services for a carrier
   */
  async getServicesByCarrier(carrierId: string) {
    const { data, error } = await this.supabase
      .from('service')
      .select('*')
      .eq('carrier_id', carrierId)
      .order('carrier_service_code', { ascending: true });

    if (error) {
      throw new Error(`Failed to get services: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get carrier ID by name
   */
  async getCarrierIdByName(carrierName: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('carrier')
      .select('id')
      .eq('name', carrierName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get carrier: ${error.message}`);
    }

    return data?.id || null;
  }
}

