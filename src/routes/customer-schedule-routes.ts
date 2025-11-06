/**
 * Customer-Facing Schedule API Routes
 * Public APIs for customers to query shipping schedules
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Add customer-facing schedule routes
 */
export function addCustomerScheduleRoutes(
  fastify: FastifyInstance,
  supabase: SupabaseClient
) {
  // API Key authentication
  const authenticateApiKey = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = (request.headers['x-api-key'] as string) || 
                   (request.headers.authorization as string)?.replace('Bearer ', '');
    const expectedKey = process.env.API_KEY || '';
    
    if (!apiKey || apiKey !== expectedKey) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      });
    }
  };

  // ============================================
  // 1. GET NEXT N SAILINGS FROM A PORT BY SERVICE
  // ============================================
  fastify.get('/api/customer/schedules/next-sailings', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { port_code, service_code, carrier, limit = '4', from_date } = request.query as any;

      if (!port_code || !service_code) {
        return reply.code(400).send({
          success: false,
          error: 'Bad Request',
          message: 'port_code and service_code are required'
        });
      }

      const limitNum = Math.min(parseInt(limit, 10) || 4, 20);
      const fromDate = from_date || new Date().toISOString().split('T')[0];

      // Get location ID for the port
      const { data: location } = await supabase
        .from('locations')
        .select('id')
        .eq('unlocode', port_code.toUpperCase())
        .single();

      if (!location?.id) {
        return reply.code(404).send({
          success: false,
          error: 'Not Found',
          message: `Port ${port_code} not found`
        });
      }

      // Get carrier ID
      const carrierName = (carrier || 'MAERSK').toUpperCase();
      const { data: carrierData } = await supabase
        .from('carrier')
        .select('id')
        .ilike('name', carrierName)
        .single();

      if (!carrierData?.id) {
        return reply.code(404).send({
          success: false,
          error: 'Not Found',
          message: `Carrier ${carrierName} not found`
        });
      }

      // Get service
      const { data: service } = await supabase
        .from('service')
        .select('id, carrier_service_code, carrier_service_name')
        .eq('carrier_id', carrierData.id)
        .eq('carrier_service_code', service_code.toUpperCase())
        .single();

      if (!service?.id) {
        return reply.code(404).send({
          success: false,
          error: 'Not Found',
          message: `Service ${service_code} not found for carrier ${carrierName}`
        });
      }

      // Get voyages for this service with transport calls from this port
      const { data: voyages } = await supabase
        .from('voyage')
        .select(`
          id,
          carrier_voyage_number,
          vessel:vessel_id (
            name,
            imo
          ),
          transport_calls:transport_call (
            id,
            sequence_no,
            location:location_id (
              unlocode,
              location_name
            ),
            port_call_times:port_call_time (
              event_type,
              time_kind,
              event_datetime
            )
          )
        `)
        .eq('service_id', service.id)
        .order('id', { ascending: false })
        .limit(100);

      if (!voyages || voyages.length === 0) {
        return reply.send({
          success: true,
          data: [],
          count: 0
        });
      }

      // Process voyages and filter by port
      const sailings: any[] = [];
      
      for (const voyage of voyages) {
        const transportCalls = voyage.transport_calls || [];
        
        // Find the transport call for the departure port
        const departureCall = transportCalls.find((tc: any) => 
          tc.location?.unlocode === port_code.toUpperCase()
        );

        if (!departureCall) continue;

        // Get departure times
        const departureTimes = departureCall.port_call_times || [];
        const plannedDeparture = departureTimes.find((t: any) => 
          t.event_type === 'DEPARTURE' && t.time_kind === 'PLANNED'
        )?.event_datetime;
        const estimatedDeparture = departureTimes.find((t: any) => 
          t.event_type === 'DEPARTURE' && t.time_kind === 'ESTIMATED'
        )?.event_datetime;

        if (!plannedDeparture && !estimatedDeparture) continue;

        // Filter by date if provided
        const departureDate = plannedDeparture || estimatedDeparture;
        if (fromDate && departureDate < fromDate) continue;

        // Build port calls array
        const portCalls = transportCalls.map((tc: any) => {
          const times = tc.port_call_times || [];
          return {
            sequence: tc.sequence_no,
            unlocode: tc.location?.unlocode,
            name: tc.location?.location_name,
            planned_arrival: times.find((t: any) => 
              t.event_type === 'ARRIVAL' && t.time_kind === 'PLANNED'
            )?.event_datetime,
            estimated_arrival: times.find((t: any) => 
              t.event_type === 'ARRIVAL' && t.time_kind === 'ESTIMATED'
            )?.event_datetime,
            planned_departure: times.find((t: any) => 
              t.event_type === 'DEPARTURE' && t.time_kind === 'PLANNED'
            )?.event_datetime,
            estimated_departure: times.find((t: any) => 
              t.event_type === 'DEPARTURE' && t.time_kind === 'ESTIMATED'
            )?.event_datetime
          };
        });

        sailings.push({
          service_code: service.carrier_service_code,
          service_name: service.carrier_service_name,
          carrier: carrierName,
          voyage_number: voyage.carrier_voyage_number,
          vessel_name: (voyage.vessel as any)?.name || 'Unknown',
          vessel_imo: (voyage.vessel as any)?.imo || null,
          port_of_departure: {
            unlocode: port_code.toUpperCase(),
            name: (departureCall.location as any)?.location_name || '',
            planned_departure: plannedDeparture,
            estimated_departure: estimatedDeparture
          },
          port_calls: portCalls,
          transit_time_days: null // Will calculate if POD is provided
        });

        if (sailings.length >= limitNum) break;
      }

      // Sort by departure date
      sailings.sort((a, b) => {
        const dateA = a.port_of_departure.planned_departure || a.port_of_departure.estimated_departure || '';
        const dateB = b.port_of_departure.planned_departure || b.port_of_departure.estimated_departure || '';
        return dateA.localeCompare(dateB);
      });

      return reply.send({
        success: true,
        data: sailings,
        count: sailings.length
      });
    } catch (error: any) {
      console.error('Error fetching next sailings:', error);
      return reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error'
      });
    }
  });

  // Helper function to find transshipment routes
  async function findTransshipmentRoutes(
    polLocationId: string,
    podLocationId: string,
    carrierId: string | null,
    fromDate: string,
    toDate: string,
    minConnectionHours: number = 24,
    sameCarrierOnly: boolean = false,
    polLocation?: { unlocode: string; location_name: string },
    podLocation?: { unlocode: string; location_name: string }
  ): Promise<any[]> {
    // Find voyages that call at POL (Leg 1)
    const { data: leg1Voyages } = await supabase
      .from('transport_call')
      .select(`
        voyage:voyage_id (
          id,
          carrier_voyage_number,
          service:service_id (
            id,
            carrier_service_code,
            carrier_service_name,
            carrier:carrier_id (id, name)
          ),
          vessel:vessel_id (name, imo)
        ),
        location:location_id (id, unlocode, location_name),
        sequence_no,
        port_call_times:port_call_time (event_type, time_kind, event_datetime)
      `)
      .eq('location_id', polLocationId);

    if (!leg1Voyages || leg1Voyages.length === 0) return [];

    const transshipmentRoutes: any[] = [];

    // For each Leg 1 voyage, find connecting Leg 2 voyages
    for (const leg1Call of leg1Voyages) {
      const leg1Voyage = leg1Call.voyage as any;
      if (!leg1Voyage) continue;

      const leg1Service = leg1Voyage.service;
      if (!leg1Service) continue;

      // Apply carrier filter for Leg 1
      if (carrierId && leg1Service.carrier?.id !== carrierId) continue;
      if (sameCarrierOnly && !leg1Service.carrier?.id) continue;

      // Get all ports in Leg 1 voyage (after POL)
      const { data: leg1AllCalls } = await supabase
        .from('transport_call')
        .select(`
          id,
          sequence_no,
          location:location_id (id, unlocode, location_name),
          port_call_times:port_call_time (event_type, time_kind, event_datetime)
        `)
        .eq('voyage_id', leg1Voyage.id)
        .gt('sequence_no', leg1Call.sequence_no)
        .order('sequence_no', { ascending: true });

      if (!leg1AllCalls || leg1AllCalls.length === 0) continue;

      // Get Leg 1 departure time from POL
      const leg1DepartureTimes = leg1Call.port_call_times || [];
      const leg1Departure = leg1DepartureTimes.find((t: any) => 
        t.event_type === 'DEPARTURE' && (t.time_kind === 'PLANNED' || t.time_kind === 'ESTIMATED')
      )?.event_datetime;

      if (!leg1Departure || leg1Departure < fromDate) continue;

      // For each port in Leg 1 (potential transshipment port), find Leg 2 voyages
      for (const transshipPortCall of leg1AllCalls) {
        const transshipLocation = transshipPortCall.location as any;
        if (!transshipLocation || transshipLocation.id === podLocationId) continue; // Skip if it's the POD

        // Get Leg 1 arrival at transshipment port
        const leg1ArrivalTimes = transshipPortCall.port_call_times || [];
        const leg1Arrival = leg1ArrivalTimes.find((t: any) => 
          t.event_type === 'ARRIVAL' && (t.time_kind === 'PLANNED' || t.time_kind === 'ESTIMATED')
        )?.event_datetime;

        if (!leg1Arrival) continue;

        // Find Leg 2 voyages that depart from transshipment port to POD
        const { data: leg2Calls } = await supabase
          .from('transport_call')
          .select(`
            voyage:voyage_id (
              id,
              carrier_voyage_number,
              service:service_id (
                id,
                carrier_service_code,
                carrier_service_name,
                carrier:carrier_id (id, name)
              ),
              vessel:vessel_id (name, imo)
            ),
            location:location_id (id, unlocode, location_name),
            sequence_no,
            port_call_times:port_call_time (event_type, time_kind, event_datetime)
          `)
          .eq('location_id', transshipLocation.id);

        if (!leg2Calls || leg2Calls.length === 0) continue;

        for (const leg2Call of leg2Calls) {
          const leg2Voyage = leg2Call.voyage as any;
          if (!leg2Voyage) continue;

          const leg2Service = leg2Voyage.service;
          if (!leg2Service) continue;

          // Check if Leg 2 goes to POD
          const { data: leg2PodCall } = await supabase
            .from('transport_call')
            .select(`
              id,
              sequence_no,
              port_call_times:port_call_time (event_type, time_kind, event_datetime)
            `)
            .eq('voyage_id', leg2Voyage.id)
            .eq('location_id', podLocationId)
            .gt('sequence_no', leg2Call.sequence_no)
            .single();

          if (!leg2PodCall) continue; // Leg 2 doesn't go to POD

          // Apply carrier filter for Leg 2
          if (carrierId && leg2Service.carrier?.id !== carrierId) continue;
          if (sameCarrierOnly && leg2Service.carrier?.id !== leg1Service.carrier?.id) continue;

          // Get Leg 2 departure from transshipment port
          const leg2DepartureTimes = leg2Call.port_call_times || [];
          const leg2Departure = leg2DepartureTimes.find((t: any) => 
            t.event_type === 'DEPARTURE' && (t.time_kind === 'PLANNED' || t.time_kind === 'ESTIMATED')
          )?.event_datetime;

          if (!leg2Departure) continue;

          // Check connection time
          const connectionTimeMs = new Date(leg2Departure).getTime() - new Date(leg1Arrival).getTime();
          const connectionTimeHours = connectionTimeMs / (1000 * 60 * 60);

          if (connectionTimeHours < minConnectionHours) continue; // Not enough connection time

          // Get Leg 2 arrival at POD
          const leg2ArrivalTimes = leg2PodCall.port_call_times || [];
          const leg2Arrival = leg2ArrivalTimes.find((t: any) => 
            t.event_type === 'ARRIVAL' && (t.time_kind === 'PLANNED' || t.time_kind === 'ESTIMATED')
          )?.event_datetime;

          if (!leg2Arrival || leg2Arrival > toDate) continue;

          // Calculate total transit time
          const totalTransitMs = new Date(leg2Arrival).getTime() - new Date(leg1Departure).getTime();
          const totalTransitDays = Math.round(totalTransitMs / (1000 * 60 * 60 * 24));

          transshipmentRoutes.push({
            route_type: 'transshipment',
            transshipment_port: {
              unlocode: transshipLocation.unlocode,
              name: transshipLocation.location_name
            },
            legs: [
              {
                leg_number: 1,
                carrier: leg1Service.carrier?.name || 'Unknown',
                service_code: leg1Service.carrier_service_code,
                service_name: leg1Service.carrier_service_name,
                voyage_number: leg1Voyage.carrier_voyage_number,
                vessel_name: leg1Voyage.vessel?.name || 'Unknown',
                vessel_imo: leg1Voyage.vessel?.imo || null,
                pol: {
                  unlocode: (leg1Call.location as any)?.unlocode,
                  name: (leg1Call.location as any)?.location_name,
                  planned_departure: leg1DepartureTimes.find((t: any) => 
                    t.event_type === 'DEPARTURE' && t.time_kind === 'PLANNED'
                  )?.event_datetime,
                  estimated_departure: leg1DepartureTimes.find((t: any) => 
                    t.event_type === 'DEPARTURE' && t.time_kind === 'ESTIMATED'
                  )?.event_datetime
                },
                pod: {
                  unlocode: transshipLocation.unlocode,
                  name: transshipLocation.location_name,
                  planned_arrival: leg1ArrivalTimes.find((t: any) => 
                    t.event_type === 'ARRIVAL' && t.time_kind === 'PLANNED'
                  )?.event_datetime,
                  estimated_arrival: leg1ArrivalTimes.find((t: any) => 
                    t.event_type === 'ARRIVAL' && t.time_kind === 'ESTIMATED'
                  )?.event_datetime
                }
              },
              {
                leg_number: 2,
                carrier: leg2Service.carrier?.name || 'Unknown',
                service_code: leg2Service.carrier_service_code,
                service_name: leg2Service.carrier_service_name,
                voyage_number: leg2Voyage.carrier_voyage_number,
                vessel_name: leg2Voyage.vessel?.name || 'Unknown',
                vessel_imo: leg2Voyage.vessel?.imo || null,
                pol: {
                  unlocode: transshipLocation.unlocode,
                  name: transshipLocation.location_name,
                  planned_departure: leg2DepartureTimes.find((t: any) => 
                    t.event_type === 'DEPARTURE' && t.time_kind === 'PLANNED'
                  )?.event_datetime,
                  estimated_departure: leg2DepartureTimes.find((t: any) => 
                    t.event_type === 'DEPARTURE' && t.time_kind === 'ESTIMATED'
                  )?.event_datetime
                },
                pod: {
                  unlocode: podLocation?.unlocode || String(podLocationId),
                  name: podLocation?.location_name || '',
                  planned_arrival: leg2ArrivalTimes.find((t: any) => 
                    t.event_type === 'ARRIVAL' && t.time_kind === 'PLANNED'
                  )?.event_datetime,
                  estimated_arrival: leg2ArrivalTimes.find((t: any) => 
                    t.event_type === 'ARRIVAL' && t.time_kind === 'ESTIMATED'
                  )?.event_datetime
                }
              }
            ],
            connection_time_hours: Math.round(connectionTimeHours),
            total_transit_days: totalTransitDays,
            pol: {
              unlocode: (leg1Call.location as any)?.unlocode,
              name: (leg1Call.location as any)?.location_name,
              planned_departure: leg1DepartureTimes.find((t: any) => 
                t.event_type === 'DEPARTURE' && t.time_kind === 'PLANNED'
              )?.event_datetime,
              estimated_departure: leg1DepartureTimes.find((t: any) => 
                t.event_type === 'DEPARTURE' && t.time_kind === 'ESTIMATED'
              )?.event_datetime
            },
            pod: {
              unlocode: podLocation?.unlocode || String(podLocationId),
              name: podLocation?.location_name || '',
              planned_arrival: leg2ArrivalTimes.find((t: any) => 
                t.event_type === 'ARRIVAL' && t.time_kind === 'PLANNED'
              )?.event_datetime,
              estimated_arrival: leg2ArrivalTimes.find((t: any) => 
                t.event_type === 'ARRIVAL' && t.time_kind === 'ESTIMATED'
              )?.event_datetime
            }
          });
        }
      }
    }

    return transshipmentRoutes;
  }

  // ============================================
  // 2. SEARCH PORT-TO-PORT ROUTES WITH SCHEDULES (WITH TRANSSHIPMENT SUPPORT)
  // ============================================
  fastify.get('/api/customer/schedules/routes', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { 
        pol_code, 
        pod_code, 
        carrier, 
        service_code, 
        from_date, 
        to_date, 
        limit = '50',
        include_transshipment = 'true',
        route_type = 'all', // 'all', 'direct_only', 'transshipment_only'
        max_transshipments = '1',
        min_connection_hours = '24',
        same_carrier_only = 'false'
      } = request.query as any;

      if (!pol_code || !pod_code) {
        return reply.code(400).send({
          success: false,
          error: 'Bad Request',
          message: 'pol_code and pod_code are required'
        });
      }

      const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
      const fromDate = from_date || new Date().toISOString().split('T')[0];
      const toDate = to_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get location IDs
      const { data: polLocation } = await supabase
        .from('locations')
        .select('id, unlocode, location_name')
        .eq('unlocode', pol_code.toUpperCase())
        .single();

      const { data: podLocation } = await supabase
        .from('locations')
        .select('id, unlocode, location_name')
        .eq('unlocode', pod_code.toUpperCase())
        .single();

      if (!polLocation || !podLocation) {
        return reply.code(404).send({
          success: false,
          error: 'Not Found',
          message: `Port ${!polLocation ? pol_code : pod_code} not found`
        });
      }

      // Get carrier filter
      let carrierId: string | null = null;
      if (carrier) {
        const { data: carrierData } = await supabase
          .from('carrier')
          .select('id')
          .ilike('name', carrier.toUpperCase())
          .single();
        carrierId = carrierData?.id || null;
      }

      // Query transport calls that go from POL to POD
      let query = supabase
        .from('transport_call')
        .select(`
          id,
          sequence_no,
          voyage:voyage_id (
            id,
            carrier_voyage_number,
            service:service_id (
              id,
              carrier_service_code,
              carrier_service_name,
              carrier:carrier_id (
                name
              )
            ),
            vessel:vessel_id (
              name,
              imo
            )
          ),
          location:location_id (
            unlocode,
            location_name
          ),
          port_call_times:port_call_time (
            event_type,
            time_kind,
            event_datetime
          )
        `)
        .or(`location_id.eq.${polLocation.id},location_id.eq.${podLocation.id}`);

      const { data: transportCalls } = await query;

      if (!transportCalls || transportCalls.length === 0) {
        return reply.send({
          success: true,
          data: [],
          count: 0
        });
      }

      // Group by voyage and filter routes
      const routesMap = new Map<string, any>();

      for (const tc of transportCalls) {
        const voyage = (tc.voyage as any);
        if (!voyage) continue;

        const service = voyage.service;
        if (!service) continue;

        // Apply filters
        if (carrierId && service.carrier?.id !== carrierId) continue;
        if (service_code && service.carrier_service_code !== service_code.toUpperCase()) continue;

        const voyageKey = `${voyage.id}_${service.carrier_service_code}`;

        if (!routesMap.has(voyageKey)) {
          routesMap.set(voyageKey, {
            voyage_id: voyage.id,
            carrier: service.carrier?.name || 'Unknown',
            service_code: service.carrier_service_code,
            service_name: service.carrier_service_name,
            voyage_number: voyage.carrier_voyage_number,
            vessel_name: voyage.vessel?.name || 'Unknown',
            pol: null,
            pod: null,
            port_calls: []
          });
        }

        const route = routesMap.get(voyageKey);
        const times = (tc.port_call_times as any[]) || [];
        const location = tc.location as any;

        if (location.unlocode === pol_code.toUpperCase()) {
          route.pol = {
            unlocode: location.unlocode,
            name: location.location_name,
            planned_departure: times.find((t: any) => 
              t.event_type === 'DEPARTURE' && t.time_kind === 'PLANNED'
            )?.event_datetime,
            estimated_departure: times.find((t: any) => 
              t.event_type === 'DEPARTURE' && t.time_kind === 'ESTIMATED'
            )?.event_datetime
          };
        }

        if (location.unlocode === pod_code.toUpperCase()) {
          route.pod = {
            unlocode: location.unlocode,
            name: location.location_name,
            planned_arrival: times.find((t: any) => 
              t.event_type === 'ARRIVAL' && t.time_kind === 'PLANNED'
            )?.event_datetime,
            estimated_arrival: times.find((t: any) => 
              t.event_type === 'ARRIVAL' && t.time_kind === 'ESTIMATED'
            )?.event_datetime
          };
        }
      }

      // Filter direct routes that have both POL and POD
      const directRoutes = Array.from(routesMap.values())
        .filter(route => route.pol && route.pod)
        .filter(route => {
          const departureDate = route.pol.planned_departure || route.pol.estimated_departure;
          if (!departureDate) return false;
          return departureDate >= fromDate && departureDate <= toDate;
        })
        .map(route => {
          // Calculate transit time
          const departure = route.pol.planned_departure || route.pol.estimated_departure;
          const arrival = route.pod.planned_arrival || route.pod.estimated_arrival;
          
          let transitTimeDays = null;
          let transitTimeHours = null;
          
          if (departure && arrival) {
            const depDate = new Date(departure);
            const arrDate = new Date(arrival);
            const diffMs = arrDate.getTime() - depDate.getTime();
            transitTimeHours = Math.round(diffMs / (1000 * 60 * 60));
            transitTimeDays = Math.round(transitTimeHours / 24);
          }

          return {
            route_type: 'direct',
            legs: [{
              leg_number: 1,
              carrier: route.carrier,
              service_code: route.service_code,
              service_name: route.service_name,
              voyage_number: route.voyage_number,
              vessel_name: route.vessel_name,
              pol: route.pol,
              pod: route.pod
            }],
            ...route,
            transit_time_days: transitTimeDays,
            transit_time_hours: transitTimeHours
          };
        });

      // Find transshipment routes if enabled
      let transshipmentRoutes: any[] = [];
      if (include_transshipment === 'true' || include_transshipment === true) {
        const minConnectionHours = parseInt(min_connection_hours, 10) || 24;
        const sameCarrierOnly = same_carrier_only === 'true' || same_carrier_only === true;
        
        transshipmentRoutes = await findTransshipmentRoutes(
          polLocation.id,
          podLocation.id,
          carrierId,
          fromDate,
          toDate,
          minConnectionHours,
          sameCarrierOnly,
          polLocation,
          podLocation
        );
      }

      // Filter routes based on route_type parameter
      let filteredDirectRoutes = directRoutes;
      let filteredTransshipmentRoutes = transshipmentRoutes;
      
      if (route_type === 'direct_only') {
        filteredTransshipmentRoutes = []; // Don't show transshipment
      } else if (route_type === 'transshipment_only') {
        filteredDirectRoutes = []; // Don't show direct (even if available)
      }
      // If route_type === 'all' (default), show both

      // Combine all routes - show both direct AND transshipment options
      // This allows customers to compare even when direct routes exist
      // (carriers sometimes offer transshipment for capacity, pricing, or frequency reasons)
      const allRoutes = [
        ...filteredDirectRoutes.map(r => ({ 
          ...r, 
          priority: 1, // Direct routes have priority 1 (shown first)
          route_preference: 'direct' // Mark as direct
        })),
        ...filteredTransshipmentRoutes.map(r => ({ 
          ...r, 
          priority: 2, // Transshipment has priority 2 (shown after direct)
          route_preference: 'transshipment' // Mark as transshipment
        }))
      ]
        .sort((a, b) => {
          // First by priority (direct first)
          if (a.priority !== b.priority) return a.priority - b.priority;
          // Then by departure date (earliest first)
          const dateA = a.pol?.planned_departure || a.pol?.estimated_departure || '';
          const dateB = b.pol?.planned_departure || b.pol?.estimated_departure || '';
          return dateA.localeCompare(dateB);
        })
        .slice(0, limitNum)
        .map(({ priority, ...route }) => route); // Remove priority from response but keep route_preference

      return reply.send({
        success: true,
        data: allRoutes,
        count: allRoutes.length,
        summary: {
          direct_routes: directRoutes.length,
          transshipment_routes: transshipmentRoutes.length,
          filtered_direct: filteredDirectRoutes.length,
          filtered_transshipment: filteredTransshipmentRoutes.length,
          route_type_filter: route_type
        },
        // Include note about why transshipment might be shown even when direct exists
        note: route_type === 'all' && directRoutes.length > 0 && transshipmentRoutes.length > 0
          ? 'Both direct and transshipment routes are shown. Carriers may offer transshipment options for capacity, pricing, or service frequency reasons even when direct routes exist.'
          : null
      });
    } catch (error: any) {
      console.error('Error fetching routes:', error);
      return reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error'
      });
    }
  });

  // Add more endpoints as needed...
  // (Service schedule, vessel tracking, transit time calculation, etc.)
}

