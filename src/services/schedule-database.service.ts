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
   * Upsert DCSA schedule using direct table inserts (tables should be in public schema)
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
      // 1. Upsert carrier - normalize name to uppercase for consistency
      const normalizedCarrierName = cleanPayload.carrierName.toUpperCase().trim();
      let carrierId: string;
      
      // Simplified approach: Try to find existing carrier first (case-insensitive)
      // This handles cases where carrier might exist with different case
      // IMPORTANT: If multiple matches exist (e.g., "Maersk" and "MAERSK"), prefer the normalized one
      const { data: allMatches } = await this.supabase
        .from('carrier')
        .select('id, name')
        .ilike('name', normalizedCarrierName);
      
      let existingCarrier: { id: string; name: string } | null = null;
      
      if (allMatches && allMatches.length > 0) {
        // If multiple matches, prefer the one that matches exactly (normalized)
        existingCarrier = allMatches.find(c => c.name === normalizedCarrierName) || allMatches[0];
        
        // If there are multiple matches and we're using a non-normalized one,
        // check if normalized version exists and use that instead
        if (existingCarrier.name !== normalizedCarrierName && allMatches.length > 1) {
          const normalizedMatch = allMatches.find(c => c.name === normalizedCarrierName);
          if (normalizedMatch) {
            existingCarrier = normalizedMatch;
          }
        }
      }
      
      if (existingCarrier?.id) {
        carrierId = existingCarrier.id;
        // Only update if name is different AND normalized version doesn't already exist
        if (existingCarrier.name !== normalizedCarrierName) {
          // Check if normalized version already exists as a separate record
          const normalizedExists = allMatches?.some(c => c.name === normalizedCarrierName && c.id !== existingCarrier.id);
          
          if (normalizedExists) {
            // Normalized version exists as separate record - use that instead
            const normalizedCarrier = allMatches!.find(c => c.name === normalizedCarrierName);
            if (normalizedCarrier) {
              carrierId = normalizedCarrier.id;
              console.log(`Using normalized carrier "${normalizedCarrierName}" instead of "${existingCarrier.name}"`);
            }
          } else {
            // Safe to update - no conflict
            const { error: updateError } = await this.supabase
              .from('carrier')
              .update({ name: normalizedCarrierName })
              .eq('id', carrierId);
            
            if (updateError) {
              // If update fails (e.g., normalized version was just created), try to find it
              if (updateError.message.includes('duplicate key') || updateError.message.includes('violates unique constraint')) {
                const { data: normalizedCarrier } = await this.supabase
                  .from('carrier')
                  .select('id, name')
                  .eq('name', normalizedCarrierName)
                  .maybeSingle();
                
                if (normalizedCarrier?.id) {
                  carrierId = normalizedCarrier.id;
                  console.log(`Normalized carrier "${normalizedCarrierName}" exists, using that instead`);
                } else {
                  console.warn(`Failed to update carrier name and normalized version not found: ${updateError.message}`);
                }
              } else {
                console.warn(`Failed to update carrier name: ${updateError.message}`);
              }
            }
          }
        }
      } else {
        // Carrier doesn't exist, try to insert
        const { data: newCarrier, error: insertError } = await this.supabase
          .from('carrier')
          .insert({ name: normalizedCarrierName })
          .select('id')
          .single();
        
        if (insertError) {
          // If duplicate key error, the carrier must exist but lookup didn't find it
          // This can happen due to race conditions or case sensitivity issues
          if (insertError.message.includes('duplicate key') || insertError.message.includes('violates unique constraint')) {
            // Retry lookup one more time (maybe it was just inserted by another request)
            const { data: retryCarrier, error: retryError } = await this.supabase
              .from('carrier')
              .select('id, name')
              .ilike('name', normalizedCarrierName)
              .limit(1)
              .maybeSingle();
            
            if (retryError) {
              console.error('Error retrying carrier lookup after duplicate key:', retryError);
              throw new Error(`Carrier lookup failed: ${retryError.message}. Original insert error: ${insertError.message}`);
            }
            
            if (!retryCarrier?.id) {
              // This shouldn't happen - if duplicate key, carrier should exist
              // But handle it gracefully - try exact match first
              console.error(`Carrier duplicate key error but case-insensitive lookup returned no results. Trying exact match...`);
              const { data: exactMatch } = await this.supabase
                .from('carrier')
                .select('id, name')
                .eq('name', normalizedCarrierName)
                .maybeSingle();
              
              if (exactMatch?.id) {
                carrierId = exactMatch.id;
                console.log(`Found carrier "${normalizedCarrierName}" using exact match`);
              } else {
                // Last resort: try to find ANY carrier with similar name (case variations)
                const { data: allCarriers } = await this.supabase
                  .from('carrier')
                  .select('id, name')
                  .ilike('name', normalizedCarrierName);
                
                if (allCarriers && allCarriers.length > 0) {
                  // Use the first match (prefer exact if available)
                  const preferred = allCarriers.find(c => c.name === normalizedCarrierName) || allCarriers[0];
                  carrierId = preferred.id;
                  console.log(`Found carrier using case-insensitive match: "${preferred.name}" (requested: "${normalizedCarrierName}")`);
                } else {
                  throw new Error(`Carrier duplicate key error but could not find existing carrier. This may indicate duplicate entries with different cases. Please run the cleanup script to remove duplicates. Error: ${insertError.message}`);
                }
              }
            } else {
              carrierId = retryCarrier.id;
              console.log(`Found carrier "${retryCarrier.name}" after retry lookup`);
            }
          } else {
            throw new Error(`Failed to insert carrier: ${insertError.message}`);
          }
        } else if (!newCarrier) {
          throw new Error('Failed to insert carrier: Unknown error - no data returned');
        } else {
          carrierId = newCarrier.id;
        }
      }

      // 2. Upsert vessel
      let vesselId: string;
      const { data: existingVessel } = await this.supabase
        .from('vessel')
        .select('id')
        .eq('imo', cleanPayload.vesselIMO)
        .maybeSingle();
      
      if (existingVessel?.id) {
        vesselId = existingVessel.id;
        // Update vessel name if it changed
        await this.supabase
          .from('vessel')
          .update({ name: cleanPayload.vesselName })
          .eq('id', vesselId);
      } else {
        const { data: newVessel, error: vesselError } = await this.supabase
          .from('vessel')
          .insert({ imo: cleanPayload.vesselIMO, name: cleanPayload.vesselName })
          .select('id')
          .single();
        
        if (vesselError) {
          // If duplicate key error, fetch the existing vessel
          if (vesselError.message.includes('duplicate key') || vesselError.message.includes('violates unique constraint')) {
            const { data: existingVessel2 } = await this.supabase
              .from('vessel')
              .select('id')
              .eq('imo', cleanPayload.vesselIMO)
              .single();
            
            if (!existingVessel2?.id) {
              throw new Error(`Vessel exists but could not be retrieved: ${vesselError.message}`);
            }
            vesselId = existingVessel2.id;
            
            // Update vessel name
            await this.supabase
              .from('vessel')
              .update({ name: cleanPayload.vesselName })
              .eq('id', vesselId);
          } else {
            throw new Error(`Failed to insert vessel: ${vesselError.message}`);
          }
        } else if (!newVessel) {
          throw new Error('Failed to insert vessel: Unknown error');
        } else {
          vesselId = newVessel.id;
        }
      }

      // 3. Upsert service
      let serviceId: string;
      const { data: existingService } = await this.supabase
        .from('service')
        .select('id')
        .eq('carrier_id', carrierId)
        .eq('carrier_service_code', cleanPayload.carrierServiceCode)
        .maybeSingle();
      
      if (existingService?.id) {
        serviceId = existingService.id;
        // Update service name if provided
        if (cleanPayload.serviceName) {
          await this.supabase
            .from('service')
            .update({ carrier_service_name: cleanPayload.serviceName })
            .eq('id', serviceId);
        }
      } else {
        const { data: newService, error: serviceError } = await this.supabase
          .from('service')
          .insert({
            carrier_id: carrierId,
            carrier_service_code: cleanPayload.carrierServiceCode,
            carrier_service_name: cleanPayload.serviceName || null,
          })
          .select('id')
          .single();
        
        if (serviceError) {
          // If duplicate key error, fetch the existing service
          if (serviceError.message.includes('duplicate key') || serviceError.message.includes('violates unique constraint')) {
            const { data: existingService2 } = await this.supabase
              .from('service')
              .select('id')
              .eq('carrier_id', carrierId)
              .eq('carrier_service_code', cleanPayload.carrierServiceCode)
              .single();
            
            if (!existingService2?.id) {
              throw new Error(`Service exists but could not be retrieved: ${serviceError.message}`);
            }
            serviceId = existingService2.id;
            
            // Update service name if provided
            if (cleanPayload.serviceName) {
              await this.supabase
                .from('service')
                .update({ carrier_service_name: cleanPayload.serviceName })
                .eq('id', serviceId);
            }
          } else {
            throw new Error(`Failed to insert service: ${serviceError.message}`);
          }
        } else if (!newService) {
          throw new Error('Failed to insert service: Unknown error');
        } else {
          serviceId = newService.id;
        }
      }

      // 4. Upsert voyage
      let voyageId: string;
      const { data: existingVoyage } = await this.supabase
        .from('voyage')
        .select('id')
        .eq('service_id', serviceId)
        .eq('carrier_voyage_number', cleanPayload.carrierVoyageNumber)
        .maybeSingle();
      
      if (existingVoyage?.id) {
        voyageId = existingVoyage.id;
        // Update vessel_id if it changed
        await this.supabase
          .from('voyage')
          .update({ vessel_id: vesselId })
          .eq('id', voyageId);
      } else {
        const { data: newVoyage, error: voyageError } = await this.supabase
          .from('voyage')
          .insert({
            service_id: serviceId,
            carrier_voyage_number: cleanPayload.carrierVoyageNumber,
            vessel_id: vesselId,
          })
          .select('id')
          .single();
        
        if (voyageError) {
          // If duplicate key error, fetch the existing voyage
          if (voyageError.message.includes('duplicate key') || voyageError.message.includes('violates unique constraint')) {
            const { data: existingVoyage2 } = await this.supabase
              .from('voyage')
              .select('id')
              .eq('service_id', serviceId)
              .eq('carrier_voyage_number', cleanPayload.carrierVoyageNumber)
              .single();
            
            if (!existingVoyage2?.id) {
              throw new Error(`Voyage exists but could not be retrieved: ${voyageError.message}`);
            }
            voyageId = existingVoyage2.id;
            
            // Update vessel_id if it changed
            await this.supabase
              .from('voyage')
              .update({ vessel_id: vesselId })
              .eq('id', voyageId);
          } else {
            throw new Error(`Failed to insert voyage: ${voyageError.message}`);
          }
        } else if (!newVoyage) {
          throw new Error('Failed to insert voyage: Unknown error');
        } else {
          voyageId = newVoyage.id;
        }
      }

      // 5. Process port calls
      if (cleanPayload.portCalls && cleanPayload.portCalls.length > 0) {
        for (const portCall of cleanPayload.portCalls) {
          await this.processPortCall(portCall, voyageId);
        }
      }

      // 6. Insert audit record
      const { error: auditError } = await this.supabase
        .from('schedule_source_audit')
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
      const { data: existingFacility } = await this.supabase
        .from('facility')
        .select('id')
        .eq('smdg_code', portCall.facilitySMDG)
        .eq('location_id', locationId)
        .maybeSingle();
      
      if (existingFacility?.id) {
        facilityId = existingFacility.id;
        // Update name if provided
        if (portCall.facilityName) {
          await this.supabase
            .from('facility')
            .update({ name: portCall.facilityName })
            .eq('id', facilityId);
        }
      } else {
        const { data: newFacility, error: facilityError } = await this.supabase
          .from('facility')
          .insert({
            smdg_code: portCall.facilitySMDG,
            name: portCall.facilityName || null,
            location_id: locationId,
          })
          .select('id')
          .single();
        
        if (!facilityError && newFacility) {
          facilityId = newFacility.id;
        }
      }
    }

    // Upsert transport call
    let transportCallId: string;
    const { data: existingTransportCall } = await this.supabase
      .from('transport_call')
      .select('id')
      .eq('voyage_id', voyageId)
      .eq('sequence_no', portCall.sequence)
      .maybeSingle();
    
    if (existingTransportCall?.id) {
      transportCallId = existingTransportCall.id;
      // Update transport call data
      await this.supabase
        .from('transport_call')
        .update({
          location_id: locationId,
          facility_id: facilityId,
          carrier_import_voyage_number: portCall.carrierImportVoyageNumber || null,
          carrier_export_voyage_number: portCall.carrierExportVoyageNumber || null,
          universal_import_voyage_reference: portCall.universalImportVoyageReference || null,
          universal_export_voyage_reference: portCall.universalExportVoyageReference || null,
          status_code: portCall.statusCode || null,
          transport_call_reference: portCall.transportCallReference || null,
        })
        .eq('id', transportCallId);
    } else {
      const { data: newTransportCall, error: transportCallError } = await this.supabase
        .from('transport_call')
        .insert({
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
        })
        .select('id')
        .single();
      
      if (transportCallError || !newTransportCall) {
        throw new Error(`Failed to insert transport call: ${transportCallError?.message || 'Unknown error'}`);
      }
      transportCallId = newTransportCall.id;
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
          // Check if time entry exists
          const { data: existingTime } = await this.supabase
            .from('port_call_time')
            .select('id')
            .eq('transport_call_id', transportCallId)
            .eq('event_type', eventType)
            .eq('time_kind', timeKind)
            .maybeSingle();
          
          if (existingTime?.id) {
            // Update existing time
            await this.supabase
              .from('port_call_time')
              .update({ event_datetime: timeValue })
              .eq('id', existingTime.id);
          } else {
            // Insert new time
            await this.supabase
              .from('port_call_time')
              .insert({
                transport_call_id: transportCallId,
                event_type: eventType,
                time_kind: timeKind,
                event_datetime: timeValue,
              });
          }
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

