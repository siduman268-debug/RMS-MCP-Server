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

interface DepartureOptions {
  cargoReadyDate?: string;
  includeUpcoming?: boolean;
  upcomingLimit?: number;
  rateValidTo?: string;
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
      .from('public_portcast_schedules')
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

