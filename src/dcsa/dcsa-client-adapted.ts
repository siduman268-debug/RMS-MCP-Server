/**
 * DCSA Client - Adapted for rms-mcp-server
 * Uses environment variables directly instead of config object
 */

import { MaerskDCSAAdapter } from './adapters/maersk.adapter.js';
import { ScheduleDatabaseService } from '../services/schedule-database.service.js';
import { DCSATransformer } from './transformers/dcsa-transformer.js';
import type { DCSAScheduleMessage } from '../types/dcsa.types.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * DCSA Client for fetching and processing schedules from carriers
 */
export class DCSAClient {
  private adapters: Map<string, MaerskDCSAAdapter>;
  private dbService: ScheduleDatabaseService;

  constructor(supabase: SupabaseClient) {
    this.adapters = new Map();
    this.dbService = new ScheduleDatabaseService(supabase);

    // Initialize Maersk adapter if configured
    const maerskConsumerKey = process.env.MAERSK_CONSUMER_KEY || process.env.MAERSK_API_KEY || '';
    const maerskApiBaseUrl = process.env.MAERSK_API_BASE_URL || 'https://api.maersk.com';

    if (maerskConsumerKey && maerskApiBaseUrl) {
      this.adapters.set(
        'MAERSK',
        new MaerskDCSAAdapter(maerskConsumerKey, maerskApiBaseUrl)
      );
    }
  }

  /**
   * Fetch schedules from a specific carrier and update database
   */
  async syncCarrierSchedules(
    carrierName: string,
    params?: {
      carrierServiceCode?: string;
      voyageNumber?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<number> {
    const adapter = this.adapters.get(carrierName.toUpperCase());

    if (!adapter) {
      throw new Error(`No DCSA adapter configured for carrier: ${carrierName}`);
    }

    const schedules = await adapter.fetchSchedules(params || {});

    let successCount = 0;
    for (const schedule of schedules) {
      try {
        await this.processSchedule(schedule);
        successCount++;
      } catch (error) {
        console.error(`Failed to process schedule: ${error}`);
        // Continue processing other schedules
      }
    }

    return successCount;
  }

  /**
   * Process a single DCSA schedule message and update database
   */
  async processSchedule(schedule: DCSAScheduleMessage): Promise<void> {
    const payload = DCSATransformer.transformToDatabasePayload(schedule);
    await this.dbService.upsertDcsaSchedule(payload);
  }

  /**
   * Register a new carrier adapter
   */
  registerAdapter(carrierName: string, adapter: MaerskDCSAAdapter): void {
    this.adapters.set(carrierName.toUpperCase(), adapter);
  }

  /**
   * Get list of configured carriers
   */
  getConfiguredCarriers(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Discover services from a carrier API
   */
  async discoverCarrierServices(
    carrierName: string,
    params?: {
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<Array<{ carrierServiceCode: string; carrierServiceName: string }>> {
    const adapter = this.adapters.get(carrierName.toUpperCase());

    if (!adapter) {
      throw new Error(`No DCSA adapter configured for carrier: ${carrierName}`);
    }

    // Check if adapter has discoverServices method
    if ('discoverServices' in adapter && typeof adapter.discoverServices === 'function') {
      return await adapter.discoverServices(params);
    }

    throw new Error(`Carrier ${carrierName} does not support service discovery`);
  }
}

