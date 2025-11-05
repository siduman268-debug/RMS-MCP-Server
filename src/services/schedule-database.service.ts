/**
 * Schedule Database Service - Adapted for rms-mcp-server
 * Uses the existing supabase client instead of creating a new one
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UpsertDcsaSchedulePayload } from '../types/schedule-database.types.js';

/**
 * Database service for schedule operations
 * Uses the existing supabase client from rms-mcp-server
 */
export class ScheduleDatabaseService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upsert DCSA schedule using the database function
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

    const payloadString = JSON.stringify(cleanPayload);
    
    // Try the v2 function first (fresh schema)
    let { error } = await this.supabase.rpc('upsert_dcsa_schedule_v2', {
      payload: payloadString,
    });

    // If v2 doesn't exist or fails, try the original function
    if (error && (error.message.includes('Could not find') || error.message.includes('upsert_dcsa_schedule_v2'))) {
      const { error: error2 } = await this.supabase.rpc('upsert_dcsa_schedule', {
        payload: payloadString,
      });
      
      if (error2) {
        throw new Error(`Failed to upsert DCSA schedule: ${error2.message}`);
      }
    } else if (error) {
      throw new Error(`Failed to upsert DCSA schedule: ${error.message}`);
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
      .order('etd', { ascending: true, nullsLast: true })
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

    query = query.order('next_etd', { ascending: true, nullsLast: true });

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

