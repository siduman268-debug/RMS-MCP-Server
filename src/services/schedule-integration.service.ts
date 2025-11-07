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
    destination?: string
  ): Promise<EarliestDeparture> {
    try {
      // Primary: Query database view for earliest departure
      const departure = await this.getEarliestDepartureFromDatabase(origin, carrier, destination);
      
      // Check if database transit time seems incorrect (too low, likely westbound/eastbound mapping issue)
      const transitTimeSeemsIncorrect = departure.found && 
        departure.transit_time_days !== undefined && 
        departure.transit_time_days < 5; // Less than 5 days is suspicious for ocean freight
      
      if (departure.found && !transitTimeSeemsIncorrect) {
        // Use schedule transit time from database (seems correct)
        return departure;
      }

      // Fallback: Use Maersk API if carrier is Maersk
      // Trigger if: no database data OR transit time seems incorrect
      if (carrier.toUpperCase() === 'MAERSK') {
        if (!this.dcsaClient) {
          console.warn('[Schedule] DCSA client not available for Maersk API fallback');
          // Return database result even if transit time is wrong (better than nothing)
          if (departure.found) return departure;
        } else {
          const reason = transitTimeSeemsIncorrect 
            ? `transit time seems incorrect (${departure.transit_time_days} days)` 
            : 'database view returned no data';
          console.log(`[Schedule] Trying Maersk API fallback for ${origin} → ${destination} because: ${reason}`);
          try {
            const maerskDeparture = await this.getEarliestDepartureFromMaerskAPI(origin, destination);
            if (maerskDeparture.found) {
              console.log(`[Schedule] ✅ Maersk API fallback successful (transit: ${maerskDeparture.transit_time_days} days)`);
              return { ...maerskDeparture, carrier: 'MAERSK' };
            } else {
              console.warn(`[Schedule] Maersk API fallback returned: ${maerskDeparture.message}`);
              // Fall back to database result if Maersk API fails
              if (departure.found) {
                console.warn(`[Schedule] Using database result despite incorrect transit time`);
                return departure;
              }
            }
          } catch (error) {
            console.error('[Schedule] Error calling Maersk API fallback:', error);
            // Fall back to database result if Maersk API errors
            if (departure.found) {
              console.warn(`[Schedule] Using database result due to Maersk API error`);
              return departure;
            }
          }
        }
      }

      // No schedule found
      return {
        found: false,
        carrier,
        message: `No schedule found for carrier ${carrier} from origin ${origin}${destination ? ` to ${destination}` : ''}`
      };
    } catch (error) {
      console.error('Error getting earliest departure:', error);
      return {
        found: false,
        carrier,
        message: `Error retrieving schedule: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get earliest departure from database view
   */
  private async getEarliestDepartureFromDatabase(
    origin: string,
    carrier: string,
    destination?: string
  ): Promise<EarliestDeparture> {
    try {
      // Query v_port_to_port_routes view
      // Note: This view may not have carrier_name, so we'll query and filter
      let query = this.supabase
        .from('v_port_to_port_routes')
        .select('*')
        .eq('origin_unlocode', origin.toUpperCase())
        .gte('origin_departure', new Date().toISOString())
        .order('origin_departure', { ascending: true })
        .limit(10); // Get multiple to filter by carrier

      // Filter by destination if provided (to get the correct route)
      if (destination) {
        query = query.eq('destination_unlocode', destination.toUpperCase());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database query error:', error);
        return { found: false, carrier, message: `Database error: ${error.message}` };
      }

      if (!data || data.length === 0) {
        return { found: false, carrier, message: 'No routes found in database' };
      }

      // Filter by carrier (case-insensitive)
      const carrierRoutes = data.filter((route: any) => {
        const routeCarrier = (route.carrier_name || route.carrier || '').toUpperCase();
        return routeCarrier === carrier.toUpperCase();
      });

      if (carrierRoutes.length === 0) {
        return { found: false, carrier, message: `No routes found for carrier ${carrier}` };
      }

      // Get earliest departure
      const earliest = carrierRoutes[0];

      // Log the raw data from view for debugging
      console.log(`[Schedule] View data for ${origin} → ${destination}:`, {
        origin_departure: earliest.origin_departure,
        destination_arrival: earliest.destination_arrival,
        view_transit_time_days: earliest.transit_time_days,
        voyage_number: earliest.carrier_voyage_number,
        all_fields: Object.keys(earliest)
      });

      // Calculate transit time correctly from origin_departure to destination_arrival
      // The view's transit_time_days might be incorrect due to westbound/eastbound mapping issues
      let calculatedTransitDays: number | undefined = undefined;
      
      // Try different field names that might exist in the view
      const departureDateStr = earliest.origin_departure || earliest.departure || earliest.etd;
      const arrivalDateStr = earliest.destination_arrival || earliest.arrival || earliest.eta;
      
      if (departureDateStr && arrivalDateStr) {
        try {
          const departureDate = new Date(departureDateStr);
          const arrivalDate = new Date(arrivalDateStr);
          
          // Only calculate if dates are valid and arrival is after departure
          if (!isNaN(departureDate.getTime()) && !isNaN(arrivalDate.getTime()) && arrivalDate > departureDate) {
            const diffMs = arrivalDate.getTime() - departureDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            calculatedTransitDays = Math.round(diffDays * 10) / 10; // Round to 1 decimal
            
            console.log(`[Schedule] Calculated transit time: ${calculatedTransitDays} days (from ${departureDateStr} to ${arrivalDateStr})`);
            
            // Log if view transit time differs significantly from calculated
            if (earliest.transit_time_days && Math.abs(earliest.transit_time_days - calculatedTransitDays) > 1) {
              console.warn(`[Schedule] Transit time mismatch for ${origin} → ${destination}: view=${earliest.transit_time_days} days, calculated=${calculatedTransitDays} days`);
            }
          } else {
            console.warn(`[Schedule] Invalid dates for transit calculation: departure=${departureDateStr}, arrival=${arrivalDateStr}`);
          }
        } catch (error) {
          console.error('[Schedule] Error calculating transit time:', error);
        }
      } else {
        console.warn(`[Schedule] Missing date fields for transit calculation. Available fields: ${Object.keys(earliest).join(', ')}`);
      }

      // Use calculated transit time if available and reasonable (> 1 day)
      // If calculated transit time is too low (< 1 day), it's likely wrong - use view's value but log warning
      // If view's transit time is also too low, we'll rely on Maersk API fallback
      let transitTimeDays: number | undefined;
      
      if (calculatedTransitDays !== undefined && calculatedTransitDays >= 1) {
        transitTimeDays = calculatedTransitDays;
      } else if (earliest.transit_time_days && earliest.transit_time_days >= 1) {
        transitTimeDays = earliest.transit_time_days;
        if (calculatedTransitDays !== undefined && calculatedTransitDays < 1) {
          console.warn(`[Schedule] Calculated transit time (${calculatedTransitDays} days) seems wrong, using view's value (${earliest.transit_time_days} days)`);
        }
      } else {
        // Both are too low - this indicates a problem with the view
        transitTimeDays = earliest.transit_time_days;
        console.error(`[Schedule] WARNING: Both calculated (${calculatedTransitDays}) and view transit time (${earliest.transit_time_days}) seem incorrect for ${origin} → ${destination}. Consider using Maersk API fallback.`);
      }

      return {
        found: true,
        carrier: carrier.toUpperCase(),
        etd: earliest.origin_departure,
        planned_departure: earliest.origin_departure,
        estimated_departure: earliest.origin_departure, // View may not have estimated
        carrier_service_code: earliest.carrier_service_code,
        carrier_voyage_number: earliest.carrier_voyage_number,
        vessel_name: earliest.vessel_name,
        vessel_imo: earliest.vessel_imo,
        transit_time_days: transitTimeDays
      };
    } catch (error) {
      console.error('Error querying database view:', error);
      return {
        found: false,
        carrier,
        message: `Database query error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get earliest departure from Maersk API (fallback)
   */
  private async getEarliestDepartureFromMaerskAPI(
    origin: string,
    destination?: string
  ): Promise<Omit<EarliestDeparture, 'carrier'>> {
    try {
      if (!this.dcsaClient) {
        return { found: false, message: 'DCSA client not available' };
      }

      // Destination is required for point-to-point API
      if (!destination) {
        return {
          found: false,
          message: 'Maersk API requires destination for point-to-point lookup'
        };
      }

      // Get Maersk adapter
      const maerskAdapter = (this.dcsaClient as any).adapters?.get('MAERSK');
      if (!maerskAdapter) {
        return { found: false, message: 'Maersk adapter not configured' };
      }

      // Call Maersk point-to-point API
      const fromDate = new Date().toISOString().split('T')[0]; // Today
      console.log(`[Schedule] Calling Maersk API: fetchPointToPoint(${origin}, ${destination}, fromDate=${fromDate})`);
      const routes = await maerskAdapter.fetchPointToPoint(
        origin.toUpperCase(),
        destination.toUpperCase(),
        {
          fromDate,
          limit: 10 // Get multiple routes to find earliest
        }
      );
      console.log(`[Schedule] Maersk API returned ${routes?.length || 0} routes`);

      if (!routes || routes.length === 0) {
        return {
          found: false,
          message: `No Maersk routes found from ${origin} to ${destination}`
        };
      }

      // Log the raw response from first route to see transitTime value
      const rawResponseSample = {
        placeOfReceipt: routes[0].placeOfReceipt,
        placeOfDelivery: routes[0].placeOfDelivery,
        transitTime: routes[0].transitTime,
        transitTimeType: typeof routes[0].transitTime,
        legs: routes[0].legs?.map((leg: any) => ({
          modeOfTransport: leg.transport?.modeOfTransport,
          departure: leg.departure?.dateTime,
          arrival: leg.arrival?.dateTime
        }))
      };
      console.log(`[Schedule] Raw Maersk API response (first route):`, JSON.stringify(rawResponseSample, null, 2));
      
      // Also log the FULL response for the earliest route
      console.log(`[Schedule] Full Maersk API response (all routes):`, JSON.stringify(routes, null, 2));

      // Find the earliest departure (routes are typically sorted, but we'll verify)
      const earliestRoute = routes.reduce((earliest: MaerskPointToPointResponse, route: MaerskPointToPointResponse) => {
        const routeDate = new Date(route.placeOfReceipt.dateTime);
        const earliestDate = new Date(earliest.placeOfReceipt.dateTime);
        return routeDate < earliestDate ? route : earliest;
      }, routes[0]);

      // Extract vessel information from the first leg (ocean leg)
      const oceanLeg = earliestRoute.legs.find((leg: MaerskLeg) => 
        leg.transport.modeOfTransport === 'VESSEL'
      ) || earliestRoute.legs[0];

      const servicePartner = oceanLeg?.transport?.servicePartners?.[0];
      const vessel = oceanLeg?.transport?.vessel;

      // Calculate transit time from placeOfReceipt to placeOfDelivery dates
      // This is more accurate than using transitTime field (which might be for a segment)
      let transitTimeDays: number | undefined = undefined;
      
      if (earliestRoute.placeOfReceipt?.dateTime && earliestRoute.placeOfDelivery?.dateTime) {
        try {
          const receiptDate = new Date(earliestRoute.placeOfReceipt.dateTime);
          const deliveryDate = new Date(earliestRoute.placeOfDelivery.dateTime);
          
          if (!isNaN(receiptDate.getTime()) && !isNaN(deliveryDate.getTime()) && deliveryDate > receiptDate) {
            const diffMs = deliveryDate.getTime() - receiptDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            transitTimeDays = Math.round(diffDays * 10) / 10; // Round to 1 decimal
            
            console.log(`[Schedule] Calculated transit from Maersk API dates: ${transitTimeDays} days (from ${earliestRoute.placeOfReceipt.dateTime} to ${earliestRoute.placeOfDelivery.dateTime})`);
            
            // Log if API's transitTime field differs significantly
            // Check if transitTime is in hours or days by comparing with calculated
            if (earliestRoute.transitTime !== undefined && earliestRoute.transitTime !== null) {
              // Try both interpretations: hours and days
              const asHours = earliestRoute.transitTime;
              const asDays = earliestRoute.transitTime;
              const hoursToDays = asHours / 24;
              
              console.log(`[Schedule] Maersk API transitTime raw value: ${earliestRoute.transitTime}`);
              console.log(`[Schedule] If hours: ${hoursToDays.toFixed(1)} days`);
              console.log(`[Schedule] If days: ${asDays.toFixed(1)} days`);
              console.log(`[Schedule] Calculated from dates: ${transitTimeDays} days`);
              
              // Determine which interpretation is closer
              const diffAsHours = Math.abs(hoursToDays - transitTimeDays);
              const diffAsDays = Math.abs(asDays - transitTimeDays);
              
              if (diffAsHours < diffAsDays) {
                console.log(`[Schedule] transitTime appears to be in HOURS (${asHours} hours = ${hoursToDays.toFixed(1)} days)`);
              } else {
                console.log(`[Schedule] transitTime appears to be in DAYS (${asDays} days)`);
              }
              
              if (Math.abs(hoursToDays - transitTimeDays) > 1 && Math.abs(asDays - transitTimeDays) > 1) {
                console.warn(`[Schedule] Maersk API transitTime (${earliestRoute.transitTime}) doesn't match calculated (${transitTimeDays} days) - using calculated from dates`);
              }
            }
          }
        } catch (error) {
          console.error('[Schedule] Error calculating transit time from Maersk API dates:', error);
        }
      }
      
      // Fallback to API's transitTime if date calculation fails
      if (transitTimeDays === undefined && earliestRoute.transitTime !== undefined && earliestRoute.transitTime !== null) {
        // transitTime is in DAYS (confirmed from API response analysis)
        transitTimeDays = Math.round(earliestRoute.transitTime * 10) / 10;
        console.log(`[Schedule] Using Maersk API transitTime field (${transitTimeDays} days) - date calculation unavailable`);
      }

      return {
        found: true,
        etd: earliestRoute.placeOfReceipt.dateTime,
        planned_departure: earliestRoute.placeOfReceipt.dateTime,
        estimated_departure: earliestRoute.placeOfReceipt.dateTime,
        carrier_service_code: servicePartner?.carrierServiceCode,
        carrier_voyage_number: servicePartner?.carrierExportVoyageNumber || servicePartner?.carrierImportVoyageNumber,
        vessel_name: vessel?.name,
        vessel_imo: vessel?.vesselIMONumber,
        transit_time_days: transitTimeDays
      };
    } catch (error) {
      console.error('Error querying Maersk API:', error);
      return {
        found: false,
        message: `Maersk API error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
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

