/**
 * Schedule Integration Service
 * Provides earliest departure information for V4 APIs
 * Uses database views as primary source, Maersk API as fallback
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DCSAClient } from '../dcsa/dcsa-client-adapted.js';
import type { MaerskPointToPointResponse, MaerskLeg } from '../types/maersk-api.types.js';

export interface EarliestDeparture {
  found: boolean;
  carrier?: string;
  etd?: string;
  planned_departure?: string;
  estimated_departure?: string;
  carrier_service_code?: string;
  carrier_voyage_number?: string;
  vessel_name?: string;
  vessel_imo?: string;
  transit_time_days?: number;
  message?: string;
}

export interface DepartureResults {
  earliest: EarliestDeparture;
  upcoming: EarliestDeparture[];
}

export interface ScheduleEntry {
  carrier: string;
  etd: string;
  eta?: string;
  transit_time_days?: number;
  service_code?: string;
  service_name?: string;
  voyage?: string;
  vessel_name?: string;
  vessel_imo?: string;
  origin_port_code?: string;
  origin_port_name?: string;
  destination_port_code?: string;
  destination_port_name?: string;
  route_name?: string;
  is_direct?: boolean;
  legs?: Array<{
    sequence?: number;
    from?: string;
    from_name?: string;
    to?: string;
    to_name?: string;
    departure?: string;
    arrival?: string;
    transport_mode?: string;
    carrier_code?: string;
    carrier_name?: string;
    voyage?: string;
    vessel_name?: string;
    vessel_imo?: string;
  }>;
  source: 'database' | 'portcast' | 'maersk';
}

interface DepartureOptions {
  cargoReadyDate?: string;
  includeUpcoming?: boolean;
  upcomingLimit?: number;
  rateValidTo?: string;
}

export interface ScheduleSearchOptions {
  destination?: string;
  cargoReadyDate?: string;
  departureFrom?: string;
  departureTo?: string;
  carrier?: string;
  serviceCode?: string;
  vesselName?: string;
  voyage?: string;
  limit?: number;
}

export class ScheduleIntegrationService {
  private supabase: SupabaseClient;
  private dcsaClient: DCSAClient | null = null;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    
    // Initialize DCSA client for Maersk API fallback
    try {
      this.dcsaClient = new DCSAClient(supabase);
    } catch (error) {
      console.warn('DCSA Client initialization failed, will use database views only:', error);
    }
  }

  /**
   * Search schedules (rate-independent) combining database, Portcast, and carrier API sources
   */
  async searchSchedules(
    origin: string,
    options: ScheduleSearchOptions = {}
  ): Promise<ScheduleEntry[]> {
    const {
      destination,
      cargoReadyDate,
      carrier,
      serviceCode,
      vesselName,
      voyage,
      limit = 20,
    } = options;

    const maxResults = Math.min(Math.max(limit, 1), 100);
    const originCode = origin.toUpperCase();
    const destinationCode = destination ? destination.toUpperCase() : undefined;
    const carrierFilter = carrier?.trim();
    const serviceFilter = serviceCode?.trim();
    const vesselFilter = vesselName?.trim();
    const voyageFilter = voyage?.trim();

    // If cargo_ready_date is provided without departure_to, expand window to 14 days
    // to include upcoming departures (similar to how rates endpoint works)
    const departureFromISO =
      options.departureFrom ??
      cargoReadyDate ??
      new Date().toISOString().split('T')[0];
    const departureToISO = options.departureTo ?? 
      (cargoReadyDate 
        ? (() => {
            const date = new Date(cargoReadyDate);
            date.setDate(date.getDate() + 14); // Add 14 days
            return date.toISOString().split('T')[0];
          })()
        : undefined);

    const fromTime = departureFromISO
      ? new Date(`${departureFromISO}T00:00:00Z`).getTime()
      : undefined;
    const toTime = departureToISO
      ? new Date(`${departureToISO}T23:59:59Z`).getTime()
      : undefined;

    const scheduleMap = new Map<
      string,
      ScheduleEntry & { priority: number }
    >();

    const addEntries = (entries: ScheduleEntry[], priority: number) => {
      for (const entry of entries) {
        if (!entry.etd) {
          continue;
        }
        const key = [
          entry.carrier || '',
          entry.etd,
          entry.voyage || '',
          entry.vessel_name || '',
          entry.source,
        ]
          .map((part) => part ?? '')
          .join('|');

        const existing = scheduleMap.get(key);
        if (!existing || priority < existing.priority) {
          scheduleMap.set(key, { ...entry, priority });
        }
      }
    };

    try {
      const dbEntries = await this.searchSchedulesFromDatabase(originCode, {
        destination: destinationCode,
        cargoReadyDate,
        departureFrom: departureFromISO,
        departureTo: departureToISO,
        carrier: carrierFilter,
        serviceCode: serviceFilter,
        vesselName: vesselFilter,
        voyage: voyageFilter,
        limit: maxResults * 2,
      });
      addEntries(dbEntries, 1);
    } catch (error) {
      console.error('[Schedule] Error querying database schedules:', error);
    }

    try {
      const portcastEntries = await this.searchSchedulesFromPortcastTable(originCode, {
        destination: destinationCode,
        cargoReadyDate,
        departureFrom: departureFromISO,
        departureTo: departureToISO,
        carrier: carrierFilter,
        serviceCode: serviceFilter,
        vesselName: vesselFilter,
        voyage: voyageFilter,
        limit: maxResults * 2,
      });
      addEntries(portcastEntries, 2);
    } catch (error) {
      console.error('[Schedule] Error querying Portcast schedules:', error);
    }

    const shouldQueryMaersk =
      (!carrierFilter ||
        carrierFilter.toUpperCase().includes('MAERSK') ||
        carrierFilter.toUpperCase().includes('MAEU')) &&
      !!this.dcsaClient;

    if (shouldQueryMaersk && destinationCode) {
      try {
        console.log(
          `[Schedule] Querying Maersk API for ${originCode} → ${destinationCode}, carrierFilter: ${carrierFilter || 'none'}`
        );
        const maerskEntries = await this.searchSchedulesFromMaersk(originCode, destinationCode, {
          departureFrom: departureFromISO,
          departureTo: departureToISO,
          carrier: carrierFilter,
          serviceCode: serviceFilter,
          vesselName: vesselFilter,
          voyage: voyageFilter,
          limit: maxResults,
        });
        console.log(`[Schedule] Maersk API returned ${maerskEntries.length} entries`);
        if (maerskEntries.length > 0) {
          console.log(`[Schedule] Maersk entries:`, maerskEntries.map((e) => ({
            carrier: e.carrier,
            etd: e.etd,
            voyage: e.voyage,
            source: e.source,
          })));
        }
        addEntries(maerskEntries, 3);
      } catch (error) {
        console.error('[Schedule] Error querying Maersk API for schedule search:', error);
      }
    } else {
      if (!destinationCode) {
        console.log(`[Schedule] Skipping Maersk API: destination not provided`);
      } else if (!this.dcsaClient) {
        console.log(`[Schedule] Skipping Maersk API: DCSA client not available`);
      } else if (carrierFilter && !carrierFilter.toUpperCase().includes('MAERSK') && !carrierFilter.toUpperCase().includes('MAEU')) {
        console.log(`[Schedule] Skipping Maersk API: carrier filter is ${carrierFilter}, not Maersk`);
      }
    }

    const allEntries = Array.from(scheduleMap.values()).map(({ priority, ...rest }) => rest);
    console.log(`[Schedule] Total entries before filtering: ${allEntries.length}`);
    console.log(`[Schedule] Entries by source:`, {
      database: allEntries.filter((e) => e.source === 'database').length,
      portcast: allEntries.filter((e) => e.source === 'portcast').length,
      maersk: allEntries.filter((e) => e.source === 'maersk').length,
    });

    const schedules = allEntries
      .filter((entry) => {
        const etdTime = entry.etd ? new Date(entry.etd).getTime() : NaN;
        if (Number.isNaN(etdTime)) {
          return false;
        }
        if (fromTime !== undefined && etdTime < fromTime) {
          return false;
        }
        if (toTime !== undefined && etdTime > toTime) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.etd).getTime();
        const bTime = new Date(b.etd).getTime();
        return aTime - bTime;
      })
      .slice(0, maxResults);

    console.log(`[Schedule] Final schedules after filtering/sorting: ${schedules.length}`);
    console.log(`[Schedule] Final schedules by source:`, {
      database: schedules.filter((e) => e.source === 'database').length,
      portcast: schedules.filter((e) => e.source === 'portcast').length,
      maersk: schedules.filter((e) => e.source === 'maersk').length,
    });

    return schedules;
  }

  /**
   * Get earliest departure for a specific origin port and carrier
   * Primary: Query database views
   * Fallback: Use Maersk API if carrier is Maersk and no database data
   * @param origin - Origin port UNLOCODE
   * @param carrier - Carrier name
   * @param destination - Optional destination port UNLOCODE (for filtering routes)
   */
  async getEarliestDeparture(
    origin: string,
    carrier: string,
    destination?: string,
    options: DepartureOptions = {}
  ): Promise<DepartureResults> {
    const {
      cargoReadyDate,
      includeUpcoming = false,
      upcomingLimit = 4,
      rateValidTo,
    } = options;

    const limit = includeUpcoming ? Math.max(1, upcomingLimit) : 1;

    try {
      const dbResults = await this.getEarliestDepartureFromDatabase(origin, carrier, destination, {
        cargoReadyDate,
        rateValidTo,
        limit,
      });

      let earliest = dbResults.earliest;
      let upcoming = includeUpcoming ? dbResults.upcoming.slice(0, upcomingLimit) : [];

      const transitTimeSeemsIncorrect =
        earliest.found &&
        earliest.transit_time_days !== undefined &&
        earliest.transit_time_days < 5;

      if (earliest.found && !transitTimeSeemsIncorrect) {
        return { earliest, upcoming };
      }

      if (carrier.toUpperCase() === 'MAERSK' && this.dcsaClient) {
        const reason = transitTimeSeemsIncorrect
          ? `transit time seems incorrect (${earliest.transit_time_days} days)`
          : 'database view returned no data';
        console.log(
          `[Schedule] Trying Maersk API fallback for ${origin} → ${destination} because: ${reason}`
        );

        try {
          const maerskResults = await this.getEarliestDepartureFromMaerskAPI(
            origin,
            destination,
            {
              cargoReadyDate,
              rateValidTo,
              limit,
            }
          );

          if (maerskResults.earliest.found) {
            console.log(
              `[Schedule] ✅ Maersk API fallback successful (transit: ${maerskResults.earliest.transit_time_days} days)`
            );
            earliest = maerskResults.earliest;
            upcoming = includeUpcoming ? maerskResults.upcoming.slice(0, upcomingLimit) : [];
            return { earliest, upcoming };
          }

          console.warn(
            `[Schedule] Maersk API fallback returned: ${maerskResults.earliest.message}`
          );
        } catch (error) {
          console.error('[Schedule] Error calling Maersk API fallback:', error);
        }
      } else if (carrier.toUpperCase() === 'MAERSK' && !this.dcsaClient) {
        console.warn('[Schedule] DCSA client not available for Maersk API fallback');
      }

      if (!earliest.found || transitTimeSeemsIncorrect) {
        try {
          const portcastResults = await this.getEarliestDepartureFromPortcastTable(
            origin,
            carrier,
            destination,
            {
              cargoReadyDate,
              rateValidTo,
              limit,
            }
          );

          if (portcastResults.earliest.found) {
            earliest = portcastResults.earliest;
            upcoming = includeUpcoming ? portcastResults.upcoming.slice(0, upcomingLimit) : [];
            return { earliest, upcoming };
          }
        } catch (error) {
          console.error('[Schedule] Error retrieving schedules from Portcast table:', error);
        }
      }

      if (earliest.found) {
        if (transitTimeSeemsIncorrect) {
          console.warn('[Schedule] Using database result despite suspicious transit time');
        }
        return { earliest, upcoming };
      }

      const message = `No schedule found for carrier ${carrier} from origin ${origin}${
        destination ? ` to ${destination}` : ''
      }${cargoReadyDate ? ` on or after ${cargoReadyDate}` : ''}`;

      return {
        earliest: {
          found: false,
          carrier,
          message,
        },
        upcoming: [],
      };
    } catch (error) {
      console.error('Error getting earliest departure:', error);
      return {
        earliest: {
          found: false,
          carrier,
          message: `Error retrieving schedule: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        upcoming: [],
      };
    }
  }

  private parsePortcastTransitTime(
    transit: string | null | undefined,
    departureDate?: string | null,
    arrivalDate?: string | null
  ): number | undefined {
    if (transit) {
      const match = transit.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    if (departureDate && arrivalDate) {
      const departure = new Date(`${departureDate}T00:00:00Z`);
      const arrival = new Date(`${arrivalDate}T00:00:00Z`);
      const diffMs = arrival.getTime() - departure.getTime();
      if (!Number.isNaN(diffMs)) {
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
      }
    }

    return undefined;
  }

  private mapPortcastScheduleToDeparture(row: any): EarliestDeparture {
    const departureIso = row.departure_date
      ? new Date(`${row.departure_date}T00:00:00Z`).toISOString()
      : undefined;
    const arrivalIso = row.arrival_date
      ? new Date(`${row.arrival_date}T00:00:00Z`).toISOString()
      : undefined;

    return {
      found: true,
      carrier: row.carrier_name ?? row.carrier_scac ?? undefined,
      etd: departureIso,
      planned_departure: departureIso,
      estimated_departure: arrivalIso,
      carrier_service_code: row.route_code ?? undefined,
      carrier_voyage_number: row.voyage ?? undefined,
      vessel_name: row.vessel_name ?? undefined,
      vessel_imo: row.vessel_imo ?? undefined,
      transit_time_days: this.parsePortcastTransitTime(
        row.transit_time,
        row.departure_date,
        row.arrival_date
      ),
      message: row.is_direct === false ? 'Transshipment service' : undefined,
    };
  }

  private async getEarliestDepartureFromPortcastTable(
    origin: string,
    carrier: string,
    destination?: string,
    options: { cargoReadyDate?: string; rateValidTo?: string; limit?: number } = {}
  ): Promise<DepartureResults> {
    const { cargoReadyDate, rateValidTo, limit = 4 } = options;

    const originCode = origin.toUpperCase();
    const destinationCode = destination?.toUpperCase();
    const carrierUpper = carrier.toUpperCase();

    const departureFilter = cargoReadyDate ?? new Date().toISOString().split('T')[0];

    let query = this.supabase
      .from('portcast_schedules')
      .select('*')
      .eq('origin_port_code', originCode)
      .order('departure_date', { ascending: true })
      .limit(Math.max(10, limit));

    query = query.gte('departure_date', departureFilter);

    if (destinationCode) {
      query = query.eq('destination_port_code', destinationCode);
    }

    if (rateValidTo) {
      query = query.lte('departure_date', rateValidTo);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const schedules = (data ?? []).filter((row: any) => {
      const name = (row.carrier_name ?? '').toUpperCase();
      const scac = (row.carrier_scac ?? '').toUpperCase();
      return name === carrierUpper || scac === carrierUpper || name.includes(carrierUpper);
    });

    if (schedules.length === 0) {
      return {
        earliest: {
          found: false,
          carrier,
          message: `No Portcast schedule found for carrier ${carrier} from ${originCode}${
            destinationCode ? ` to ${destinationCode}` : ''
          }${departureFilter ? ` on or after ${departureFilter}` : ''}`,
        },
        upcoming: [],
      };
    }

    const mapped = schedules.slice(0, limit).map((row: any) => this.mapPortcastScheduleToDeparture(row));

    return {
      earliest: mapped[0],
      upcoming: mapped.slice(1),
    };
  }

  /**
   * Search schedules from database view
   */
  private async searchSchedulesFromDatabase(
    origin: string,
    options: ScheduleSearchOptions & { destination?: string; limit?: number }
  ): Promise<ScheduleEntry[]> {
    const {
      destination,
      cargoReadyDate,
      departureFrom,
      departureTo,
      carrier,
      serviceCode,
      vesselName,
      voyage,
      limit = 50,
    } = options;

    let query = this.supabase
      .from('v_port_to_port_routes')
      .select('*')
      .eq('origin_unlocode', origin)
      .order('origin_departure', { ascending: true })
      .limit(Math.min(Math.max(limit, 10), 200));

    const fromIso = departureFrom ?? cargoReadyDate;
    const toIso = departureTo ?? cargoReadyDate;

    const fromIsoString = fromIso
      ? new Date(`${fromIso}T00:00:00Z`).toISOString()
      : new Date().toISOString();
    const toIsoString = toIso
      ? new Date(`${toIso}T23:59:59Z`).toISOString()
      : undefined;

    query = query.gte('origin_departure', fromIsoString);

    if (toIsoString) {
      query = query.lte('origin_departure', toIsoString);
    }

    if (destination) {
      query = query.eq('destination_unlocode', destination);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const carrierUpper = carrier?.toUpperCase();
    const serviceUpper = serviceCode?.toUpperCase();
    const vesselUpper = vesselName?.toUpperCase();
    const voyageUpper = voyage?.toUpperCase();

    const filtered = (data || []).filter((route: any) => {
      const routeCarrier = (route.carrier || route.vendor || '').toUpperCase();
      if (carrierUpper && !routeCarrier.includes(carrierUpper)) {
        return false;
      }

      if (serviceUpper) {
        const serviceMatch =
          (route.service_code && route.service_code.toUpperCase().includes(serviceUpper)) ||
          (route.service_name && route.service_name.toUpperCase().includes(serviceUpper)) ||
          (route.carrier_service_code &&
            route.carrier_service_code.toUpperCase().includes(serviceUpper));
        if (!serviceMatch) {
          return false;
        }
      }

      if (vesselUpper) {
        const vesselMatch =
          (route.vessel_name && route.vessel_name.toUpperCase().includes(vesselUpper)) ||
          (route.vessel_imo && route.vessel_imo.toUpperCase().includes(vesselUpper));
        if (!vesselMatch) {
          return false;
        }
      }

      if (voyageUpper) {
        const voyageMatch =
          (route.voyage_number && route.voyage_number.toUpperCase().includes(voyageUpper)) ||
          (route.carrier_voyage_number &&
            route.carrier_voyage_number.toUpperCase().includes(voyageUpper));
        if (!voyageMatch) {
          return false;
        }
      }

      return true;
    });

    return filtered
      .map((route: any) => this.mapDatabaseRouteToSchedule(route))
      .filter((entry): entry is ScheduleEntry => entry !== null);
  }

  /**
   * Search schedules from Portcast table
   */
  private async searchSchedulesFromPortcastTable(
    origin: string,
    options: ScheduleSearchOptions & { destination?: string; limit?: number }
  ): Promise<ScheduleEntry[]> {
    const {
      destination,
      cargoReadyDate,
      departureFrom,
      departureTo,
      carrier,
      serviceCode,
      vesselName,
      voyage,
      limit = 50,
    } = options;

    const departureFilter = departureFrom ?? cargoReadyDate ?? new Date().toISOString().split('T')[0];
    const departureToFilter = departureTo ?? cargoReadyDate ?? undefined;

    let query = this.supabase
      .from('portcast_schedules')
      .select('*')
      .eq('origin_port_code', origin)
      .order('departure_date', { ascending: true })
      .limit(Math.min(Math.max(limit, 10), 200));

    query = query.gte('departure_date', departureFilter);

    if (destination) {
      query = query.eq('destination_port_code', destination);
    }

    if (departureToFilter) {
      query = query.lte('departure_date', departureToFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const carrierUpper = carrier?.toUpperCase();
    const serviceUpper = serviceCode?.toUpperCase();
    const vesselUpper = vesselName?.toUpperCase();
    const voyageUpper = voyage?.toUpperCase();

    const filtered = (data || []).filter((row: any) => {
      const rowCarrier =
        (row.carrier_name || row.carrier_scac || '').toUpperCase();
      if (carrierUpper && !rowCarrier.includes(carrierUpper)) {
        return false;
      }

      if (serviceUpper) {
        const serviceMatch =
          (row.route_code && row.route_code.toUpperCase().includes(serviceUpper)) ||
          (row.route_name && row.route_name.toUpperCase().includes(serviceUpper));
        if (!serviceMatch) {
          return false;
        }
      }

      if (vesselUpper) {
        const vesselMatch =
          (row.vessel_name && row.vessel_name.toUpperCase().includes(vesselUpper)) ||
          (row.vessel_imo && row.vessel_imo.toUpperCase().includes(vesselUpper));
        if (!vesselMatch) {
          return false;
        }
      }

      if (voyageUpper) {
        const voyageMatch =
          row.voyage && row.voyage.toUpperCase().includes(voyageUpper);
        if (!voyageMatch) {
          return false;
        }
      }

      return true;
    });

    return filtered
      .map((row: any) => this.mapPortcastRowToSchedule(row))
      .filter((entry): entry is ScheduleEntry => entry !== null);
  }

  /**
   * Search schedules from Maersk DCSA API
   */
  private async searchSchedulesFromMaersk(
    origin: string,
    destination: string,
    options: ScheduleSearchOptions & { limit?: number }
  ): Promise<ScheduleEntry[]> {
    if (!this.dcsaClient) {
      return [];
    }

    const maerskAdapter = (this.dcsaClient as any).adapters?.get('MAERSK');
    if (!maerskAdapter) {
      return [];
    }

    const fromDate =
      options.departureFrom ??
      options.cargoReadyDate ??
      new Date().toISOString().split('T')[0];

    const routes: MaerskPointToPointResponse[] =
      await maerskAdapter.fetchPointToPoint(
        origin.toUpperCase(),
        destination.toUpperCase(),
        fromDate
      );

    if (!routes || routes.length === 0) {
      return [];
    }

    const carrierUpper = options.carrier?.toUpperCase();
    const serviceUpper = options.serviceCode?.toUpperCase();
    const vesselUpper = options.vesselName?.toUpperCase();
    const voyageUpper = options.voyage?.toUpperCase();

    const fromTime = options.departureFrom
      ? new Date(`${options.departureFrom}T00:00:00Z`).getTime()
      : undefined;
    const toTime = options.departureTo
      ? new Date(`${options.departureTo}T23:59:59Z`).getTime()
      : undefined;

    const entries: ScheduleEntry[] = [];

    for (const route of routes) {
      const entry = this.mapMaerskRouteToSchedule(route, origin, destination);
      if (!entry) {
        continue;
      }

      const etdTime = entry.etd ? new Date(entry.etd).getTime() : NaN;
      if (Number.isNaN(etdTime)) {
        continue;
      }
      if (fromTime !== undefined && etdTime < fromTime) {
        continue;
      }
      if (toTime !== undefined && etdTime > toTime) {
        continue;
      }

      if (
        carrierUpper &&
        entry.carrier &&
        !entry.carrier.toUpperCase().includes(carrierUpper)
      ) {
        continue;
      }

      if (
        serviceUpper &&
        !(
          (entry.service_code &&
            entry.service_code.toUpperCase().includes(serviceUpper)) ||
          (entry.service_name &&
            entry.service_name.toUpperCase().includes(serviceUpper))
        )
      ) {
        continue;
      }

      if (
        vesselUpper &&
        entry.vessel_name &&
        !entry.vessel_name.toUpperCase().includes(vesselUpper)
      ) {
        continue;
      }

      if (
        voyageUpper &&
        entry.voyage &&
        !entry.voyage.toUpperCase().includes(voyageUpper)
      ) {
        continue;
      }

      entries.push(entry);

      if (entries.length >= (options.limit ?? 50)) {
        break;
      }
    }

    return entries;
  }

  /**
   * Get earliest departure from database view
   */
  private async getEarliestDepartureFromDatabase(
    origin: string,
    carrier: string,
    destination?: string,
    options: { cargoReadyDate?: string; rateValidTo?: string; limit?: number } = {}
  ): Promise<DepartureResults> {
    const { cargoReadyDate, rateValidTo, limit = 4 } = options;

    try {
      // Query v_port_to_port_routes view
      // Note: This view may not have carrier_name, so we'll query and filter
      let query = this.supabase
        .from('v_port_to_port_routes')
        .select('*')
        .eq('origin_unlocode', origin.toUpperCase())
        .order('origin_departure', { ascending: true })
        .limit(Math.max(10, limit));

      const cargoDateIso = cargoReadyDate
        ? new Date(cargoReadyDate).toISOString()
        : new Date().toISOString();

      query = query.gte('origin_departure', cargoDateIso);

      // Filter by destination if provided (to get the correct route)
      if (destination) {
        query = query.eq('destination_unlocode', destination.toUpperCase());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database query error:', error);
        return {
          earliest: {
            found: false,
            carrier,
            message: `Database error: ${error.message}`,
          },
          upcoming: [],
        };
      }

      if (!data || data.length === 0) {
        return {
          earliest: {
            found: false,
            carrier,
            message: 'No routes found in database',
          },
          upcoming: [],
        };
      }

      // Filter by carrier (case-insensitive)
      const carrierRoutes = data.filter((route: any) => {
        const routeCarrier = (route.carrier_name || route.carrier || '').toUpperCase();
        return routeCarrier === carrier.toUpperCase();
      });

      if (carrierRoutes.length === 0) {
        return {
          earliest: {
            found: false,
            carrier,
            message: `No routes found for carrier ${carrier}`,
          },
          upcoming: [],
        };
      }

      const mappedDepartures: EarliestDeparture[] = [];

      for (const route of carrierRoutes) {
        const mapped = this.mapRouteToDeparture(route, carrier);
        if (!mapped) continue;

        if (rateValidTo) {
          const departureDate = mapped.etd ? new Date(mapped.etd) : undefined;
          if (departureDate && departureDate > new Date(`${rateValidTo}T23:59:59Z`)) {
            continue;
          }
        }

        mappedDepartures.push(mapped);

        if (mappedDepartures.length >= Math.max(1, limit)) {
          break;
        }
      }

      if (mappedDepartures.length === 0) {
        return {
          earliest: {
            found: false,
            carrier,
            message: 'No departures match the requested date/validity window',
          },
          upcoming: [],
        };
      }

      console.log(`[Schedule] View data for ${origin} → ${destination}:`, {
        carrier,
        cargoReadyDate,
        rateValidTo,
        earliest: mappedDepartures[0],
      });

      return {
        earliest: mappedDepartures[0],
        upcoming: mappedDepartures.slice(1),
      };
    } catch (error) {
      console.error('Error querying database view:', error);
      return {
        earliest: {
          found: false,
          carrier,
          message: `Database query error: ${error instanceof Error ? error.message : String(error)}`,
        },
        upcoming: [],
      };
    }
  }

  /**
   * Get earliest departure from Maersk API (fallback)
   */
  private async getEarliestDepartureFromMaerskAPI(
    origin: string,
    destination?: string,
    options: { cargoReadyDate?: string; rateValidTo?: string; limit?: number } = {}
  ): Promise<DepartureResults> {
    const { cargoReadyDate, rateValidTo, limit = 4 } = options;

    if (!this.dcsaClient) {
      return {
        earliest: { found: false, message: 'DCSA client not available' },
        upcoming: [],
      };
    }

    if (!destination) {
      return {
        earliest: {
          found: false,
          message: 'Maersk API requires destination for point-to-point lookup',
        },
        upcoming: [],
      };
    }

    const maerskAdapter = (this.dcsaClient as any).adapters?.get('MAERSK');
    if (!maerskAdapter) {
      return {
        earliest: { found: false, message: 'Maersk adapter not configured' },
        upcoming: [],
      };
    }

    try {
      const fromDate = cargoReadyDate
        ? new Date(cargoReadyDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      console.log(
        `[Schedule] Calling Maersk API: fetchPointToPoint(${origin}, ${destination}, fromDate=${fromDate})`
      );

      const routes: MaerskPointToPointResponse[] = await maerskAdapter.fetchPointToPoint(
        origin.toUpperCase(),
        destination.toUpperCase(),
        fromDate
      );

      console.log(`[Schedule] Maersk API returned ${routes?.length || 0} routes`);

      if (!routes || routes.length === 0) {
        return {
          earliest: {
            found: false,
            message: `No Maersk routes found from ${origin} to ${destination}`,
          },
          upcoming: [],
        };
      }

      const mapped: EarliestDeparture[] = [];
      for (const route of routes) {
        const departure = this.mapMaerskRouteToDeparture(route);
        if (!departure) continue;

        if (rateValidTo) {
          const departureDate = departure.etd ? new Date(departure.etd) : undefined;
          if (departureDate && departureDate > new Date(`${rateValidTo}T23:59:59Z`)) {
            continue;
          }
        }

        mapped.push(departure);
        if (mapped.length >= Math.max(1, limit)) {
          break;
        }
      }

      if (mapped.length === 0) {
        return {
          earliest: {
            found: false,
            message: 'Maersk routes exist but none match the requested validity window',
          },
          upcoming: [],
        };
      }

      return {
        earliest: mapped[0],
        upcoming: mapped.slice(1),
      };
    } catch (error) {
      console.error('Error querying Maersk API:', error);
      return {
        earliest: {
          found: false,
          message: `Maersk API error: ${error instanceof Error ? error.message : String(error)}`,
        },
        upcoming: [],
      };
    }
  }

  private mapRouteToDeparture(route: any, carrier: string): EarliestDeparture | null {
    const departure = route.origin_departure || route.departure || route.etd;
    if (!departure) {
      return null;
    }

    const arrival = route.destination_arrival || route.arrival || route.eta;
    let transitTimeDays = route.transit_time_days;

    if (arrival) {
      try {
        const departureDate = new Date(departure);
        const arrivalDate = new Date(arrival);
        if (!isNaN(departureDate.getTime()) && !isNaN(arrivalDate.getTime()) && arrivalDate > departureDate) {
          const diffMs = arrivalDate.getTime() - departureDate.getTime();
          transitTimeDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
        }
      } catch (error) {
        console.error('[Schedule] Error calculating transit time from database view:', error);
      }
    }

    return {
      found: true,
      carrier: carrier.toUpperCase(),
      etd: departure,
      planned_departure: departure,
      estimated_departure: arrival,
      carrier_service_code: route.carrier_service_code || route.service_code,
      carrier_voyage_number: route.carrier_voyage_number || route.voyage_number,
      vessel_name: route.vessel_name,
      vessel_imo: route.vessel_imo,
      transit_time_days: transitTimeDays,
    };
  }

  private mapMaerskRouteToDeparture(route: MaerskPointToPointResponse): EarliestDeparture | null {
    const receipt = route.placeOfReceipt?.dateTime;
    if (!receipt) {
      return null;
    }

    const delivery = route.placeOfDelivery?.dateTime;
    let transitTimeDays: number | undefined;

    const oceanLeg = route.legs?.find(
      (leg: MaerskLeg) => leg.transport?.modeOfTransport === 'VESSEL'
    );

    const legDeparture =
      oceanLeg?.departure ||
      (oceanLeg as any)?.departureDateTime ||
      (oceanLeg as any)?.departureDate ||
      receipt;

    const legArrival =
      oceanLeg?.arrival ||
      (oceanLeg as any)?.arrivalDateTime ||
      (oceanLeg as any)?.arrivalDate ||
      delivery;

    if (legDeparture && legArrival) {
      try {
        const departureDate = new Date(legDeparture);
        const arrivalDate = new Date(legArrival);
        if (!isNaN(departureDate.getTime()) && !isNaN(arrivalDate.getTime()) && arrivalDate > departureDate) {
          const diffMs = arrivalDate.getTime() - departureDate.getTime();
          transitTimeDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
        }
      } catch (error) {
        console.error('[Schedule] Error calculating transit time from Maersk API data:', error);
      }
    }

    if (transitTimeDays === undefined && route.transitTime !== undefined && route.transitTime !== null) {
      if (typeof route.transitTime === 'number') {
        transitTimeDays = Math.round(route.transitTime * 10) / 10;
      }
    }

    const firstLeg = route.legs?.[0];
    const transport = firstLeg?.transport;
    const vessel = transport?.vessel;
    const servicePartner = transport?.servicePartners?.[0];

    return {
      found: true,
      carrier: 'MAERSK',
      etd: receipt,
      planned_departure: receipt,
      estimated_departure: delivery,
      carrier_service_code:
        servicePartner?.carrierServiceCode ||
        (route.solutionNumber ? `Solution ${route.solutionNumber}` : undefined),
      carrier_voyage_number:
        servicePartner?.carrierExportVoyageNumber ||
        servicePartner?.carrierImportVoyageNumber ||
        route.routingReference,
      vessel_name: vessel?.name,
      vessel_imo: vessel?.vesselIMONumber,
      transit_time_days: transitTimeDays,
    };
  }

  private mapDatabaseRouteToSchedule(route: any): ScheduleEntry | null {
    const departure = route.origin_departure || route.departure || route.etd;
    if (!departure) {
      return null;
    }

    const arrival = route.destination_arrival || route.arrival || route.eta;
    let transitTimeDays = route.transit_time_days;

    if (arrival) {
      try {
        const departureDate = new Date(departure);
        const arrivalDate = new Date(arrival);
        if (!isNaN(departureDate.getTime()) && !isNaN(arrivalDate.getTime()) && arrivalDate > departureDate) {
          const diffMs = arrivalDate.getTime() - departureDate.getTime();
          transitTimeDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
        }
      } catch (error) {
        console.error('[Schedule] Error calculating transit time from database schedule entry:', error);
      }
    }

    return {
      carrier: (route.carrier || route.vendor || '').toUpperCase(),
      etd: departure,
      eta: arrival,
      transit_time_days: transitTimeDays,
      service_code: route.service_code || route.carrier_service_code,
      service_name: route.service_name,
      voyage: route.voyage_number || route.carrier_voyage_number,
      vessel_name: route.vessel_name,
      vessel_imo: route.vessel_imo,
      origin_port_code: route.origin_unlocode,
      origin_port_name: route.origin_name || route.origin_port_name,
      destination_port_code: route.destination_unlocode,
      destination_port_name: route.destination_name || route.destination_port_name,
      route_name: route.service_name,
      is_direct: route.is_direct_service ?? undefined,
      source: 'database',
    };
  }

  private mapPortcastRowToSchedule(row: any): ScheduleEntry | null {
    if (!row) {
      return null;
    }

    const departureIso = row.departure_date
      ? new Date(`${row.departure_date}T00:00:00Z`).toISOString()
      : undefined;

    if (!departureIso) {
      return null;
    }

    const arrivalIso = row.arrival_date
      ? new Date(`${row.arrival_date}T00:00:00Z`).toISOString()
      : undefined;

    return {
      carrier: (row.carrier_name || row.carrier_scac || '').toUpperCase(),
      etd: departureIso,
      eta: arrivalIso,
      transit_time_days: this.parsePortcastTransitTime(
        row.transit_time,
        row.departure_date,
        row.arrival_date
      ),
      service_code: row.route_code,
      service_name: row.route_name,
      voyage: row.voyage,
      vessel_name: row.vessel_name,
      vessel_imo: row.vessel_imo,
      origin_port_code: row.origin_port_code,
      origin_port_name: row.origin_port_name,
      destination_port_code: row.destination_port_code,
      destination_port_name: row.destination_port_name,
      route_name: row.route_name,
      is_direct: row.is_direct ?? undefined,
      source: 'portcast',
    };
  }

  private mapMaerskRouteToSchedule(
    route: MaerskPointToPointResponse,
    origin?: string,
    destination?: string
  ): ScheduleEntry | null {
    const receipt = route.placeOfReceipt?.dateTime;
    if (!receipt) {
      return null;
    }

    const delivery = route.placeOfDelivery?.dateTime;

    let transitTimeDays: number | undefined =
      typeof route.transitTime === 'number'
        ? Math.round(route.transitTime * 10) / 10
        : undefined;

    if (!transitTimeDays && delivery) {
      try {
        const departureDate = new Date(receipt);
        const arrivalDate = new Date(delivery);
        if (!isNaN(departureDate.getTime()) && !isNaN(arrivalDate.getTime()) && arrivalDate > departureDate) {
          const diffMs = arrivalDate.getTime() - departureDate.getTime();
          transitTimeDays = Math.round((diffMs / (1000 * 60 * 60 * 24)) * 10) / 10;
        }
      } catch (error) {
        console.error('[Schedule] Error calculating transit time from Maersk schedule:', error);
      }
    }

    const firstLeg = route.legs?.[0];
    const servicePartner = firstLeg?.transport?.servicePartners?.[0];
    const vessel =
      route.legs?.find(
        (leg: MaerskLeg) => leg.transport?.modeOfTransport === 'VESSEL'
      )?.transport?.vessel ?? firstLeg?.transport?.vessel;

    const legs =
      route.legs?.map((leg: MaerskLeg) => ({
        sequence: leg.sequenceNumber,
        from: leg.departure?.location?.UNLocationCode,
        from_name: leg.departure?.location?.locationName,
        to: leg.arrival?.location?.UNLocationCode,
        to_name: leg.arrival?.location?.locationName,
        departure: leg.departure?.dateTime,
        arrival: leg.arrival?.dateTime,
        transport_mode: leg.transport?.modeOfTransport,
        carrier_code: leg.transport?.servicePartners?.[0]?.carrierCode,
        carrier_name: leg.transport?.servicePartners?.[0]?.carrierServiceName,
        voyage:
          leg.transport?.servicePartners?.[0]?.carrierExportVoyageNumber ||
          leg.transport?.servicePartners?.[0]?.carrierImportVoyageNumber,
        vessel_name: leg.transport?.vessel?.name,
        vessel_imo: leg.transport?.vessel?.vesselIMONumber,
      })) ?? [];

    const originCode =
      route.placeOfReceipt?.location?.UNLocationCode ?? origin;
    const originName =
      route.placeOfReceipt?.location?.locationName ?? undefined;
    const destinationCode =
      route.placeOfDelivery?.location?.UNLocationCode ?? destination;
    const destinationName =
      route.placeOfDelivery?.location?.locationName ?? undefined;

    return {
      carrier: 'MAERSK',
      etd: receipt,
      eta: delivery,
      transit_time_days: transitTimeDays,
      service_code: servicePartner?.carrierServiceCode,
      service_name: servicePartner?.carrierServiceName,
      voyage:
        servicePartner?.carrierExportVoyageNumber ||
        servicePartner?.carrierImportVoyageNumber ||
        route.routingReference?.toString(),
      vessel_name: vessel?.name,
      vessel_imo: vessel?.vesselIMONumber,
      origin_port_code: originCode,
      origin_port_name: originName,
      destination_port_code: destinationCode,
      destination_port_name: destinationName,
      route_name: servicePartner?.carrierServiceName,
      is_direct: (route.legs?.length ?? 0) <= 1,
      legs,
      source: 'maersk',
    };
  }

  private earliestDepartureToSchedule(
    departure: EarliestDeparture,
    origin?: string,
    destination?: string,
    source: 'database' | 'portcast' | 'maersk' = 'database'
  ): ScheduleEntry | null {
    if (!departure.found || !departure.etd) {
      return null;
    }

    return {
      carrier: (departure.carrier || '').toUpperCase(),
      etd: departure.etd,
      eta: departure.estimated_departure,
      transit_time_days: departure.transit_time_days,
      service_code: departure.carrier_service_code,
      voyage: departure.carrier_voyage_number,
      vessel_name: departure.vessel_name,
      vessel_imo: departure.vessel_imo,
      origin_port_code: origin,
      destination_port_code: destination,
      source,
    };
  }

  /**
   * Check if a port is inland (ICD)
   */
  async isInlandPort(unlocode: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('locations')
        .select('location_type')
        .eq('unlocode', unlocode.toUpperCase())
        .single();

      if (error || !data) {
        console.warn(`Location not found for ${unlocode}, assuming seaport`);
        return false;
      }

      return data.location_type === 'ICD';
    } catch (error) {
      console.error(`Error checking if port is inland for ${unlocode}:`, error);
      return false; // Default to seaport on error
    }
  }

  /**
   * Check if origin and/or destination are inland ports
   */
  async checkInlandPorts(origin: string, destination: string): Promise<{
    originIsInland: boolean;
    destinationIsInland: boolean;
  }> {
    const [originIsInland, destinationIsInland] = await Promise.all([
      this.isInlandPort(origin),
      this.isInlandPort(destination)
    ]);

    return {
      originIsInland,
      destinationIsInland
    };
  }
}

