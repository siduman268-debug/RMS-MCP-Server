/**
 * Schedule Routes for rms-mcp-server
 * Add these routes to the Fastify server
 */

import { DCSAClient } from '../dcsa/dcsa-client-adapted.js';
import { ScheduleDatabaseService } from '../services/schedule-database.service.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Add schedule routes to Fastify server
 */
export function addScheduleRoutes(
  fastify: FastifyInstance,
  supabase: SupabaseClient
) {
  const dcsaClient = new DCSAClient(supabase);
  const dbService = new ScheduleDatabaseService(supabase);

  // Webhook authentication middleware (for DCSA endpoints)
  const verifyWebhookSecret = async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-webhook-signature'] as string;
    const secret = process.env.WEBHOOK_SECRET || '';
    
    if (secret && signature !== secret) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid webhook signature'
      });
    }
  };

  // API Key authentication (for Salesforce endpoints)
  const authenticateApiKey = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = (request.headers['x-api-key'] as string) || 
                   (request.headers.authorization as string)?.replace('Bearer ', '');
    const expectedKey = process.env.API_KEY || '';
    
    if (!apiKey || apiKey !== expectedKey) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      });
    }
  };

  // ============================================
  // DCSA ENDPOINTS (Internal - for n8n)
  // ============================================

  // DCSA Sync endpoint
  fastify.post('/api/dcsa/sync/:carrier', {
    preHandler: [verifyWebhookSecret]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { carrier } = request.params as { carrier: string };
      const { carrierServiceCode, voyageNumber, fromDate, toDate } = request.query as any;

      const count = await dcsaClient.syncCarrierSchedules(carrier, {
        carrierServiceCode,
        voyageNumber,
        fromDate,
        toDate,
      });

      return reply.code(200).send({
        success: true,
        message: `Synced ${count} schedules from ${carrier}`,
        count,
      });
    } catch (error: any) {
      console.error('Error syncing carrier schedules:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // DCSA Webhook endpoint
  fastify.post('/api/dcsa/webhook', {
    preHandler: [verifyWebhookSecret]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = request.body as any;
      
      // Accept both formats: { schedule: {...} } or direct schedule object
      const schedule = payload.schedule || payload;
      
      // Validate it's a schedule object (has required fields)
      if (!schedule || !schedule.carrierName || !schedule.carrierServiceCode) {
        console.error('Invalid schedule payload:', JSON.stringify(schedule, null, 2));
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Missing or invalid schedule data. Expected schedule object with carrierName and carrierServiceCode.',
        });
      }

      console.log('Processing schedule:', schedule.carrierName, schedule.carrierServiceCode, schedule.carrierVoyageNumber);
      console.log('Schedule payload structure:', {
        hasCarrierName: !!schedule.carrierName,
        hasServiceCode: !!schedule.carrierServiceCode,
        hasVoyageNumber: !!schedule.carrierVoyageNumber,
        portCallsCount: Array.isArray(schedule.portCalls) ? schedule.portCalls.length : 0,
        keys: Object.keys(schedule)
      });
      await dcsaClient.processSchedule(schedule);

      return reply.code(200).send({
        success: true,
        message: 'Schedule processed successfully',
      });
    } catch (error: any) {
      console.error('Error processing DCSA webhook:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // Discover Services endpoint
  fastify.post('/api/dcsa/discover-services/:carrier', {
    preHandler: [verifyWebhookSecret]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { carrier } = request.params as { carrier: string };
      const { fromDate, toDate } = request.query as any;

      const services = await dcsaClient.discoverCarrierServices(carrier, {
        fromDate,
        toDate,
      });

      return reply.code(200).send({
        success: true,
        message: `Discovered ${services.length} services from ${carrier}`,
        services,
        count: services.length,
      });
    } catch (error: any) {
      console.error('Error discovering services:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // ============================================
  // SALESFORCE SCHEDULE ENDPOINTS
  // ============================================

  // Get Schedules
  fastify.get('/api/schedules', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { carrier, serviceCode, voyageNumber, fromDate, toDate } = request.query as any;

      let query = supabase
        .from('v_port_calls')
        .select('*');

      if (carrier) {
        query = query.ilike('carrier_name', carrier);
      }
      if (serviceCode) {
        query = query.eq('carrier_service_code', serviceCode);
      }
      if (voyageNumber) {
        query = query.eq('carrier_voyage_number', voyageNumber);
      }
      if (fromDate) {
        query = query.gte('event_datetime', fromDate);
      }
      if (toDate) {
        query = query.lte('event_datetime', toDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);

      if (error) throw error;

      return reply.send({
        success: true,
        data: data || [],
        count: data?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching schedules:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // Get Next Departures
  fastify.get('/api/next-departures', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { originLocationId, carrier, limit } = request.query as any;

      if (!originLocationId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'originLocationId is required',
        });
      }

      const data = await dbService.getNextDepartures(
        originLocationId,
        limit ? parseInt(limit, 10) : 10
      );

      let filtered = data;
      if (carrier) {
        filtered = data.filter((d: any) =>
          d.carrier_name?.toLowerCase().includes(carrier.toLowerCase())
        );
      }

      return reply.send({
        success: true,
        data: filtered,
        count: filtered.length,
      });
    } catch (error: any) {
      console.error('Error fetching next departures:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // Get Destination ETA
  fastify.get('/api/destination-eta', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { voyageId, destinationLocationId } = request.query as any;

      if (!voyageId || !destinationLocationId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'voyageId and destinationLocationId are required',
        });
      }

      const data = await dbService.getDestinationETA(voyageId, destinationLocationId);

      return reply.send({
        success: true,
        data: data || null,
      });
    } catch (error: any) {
      console.error('Error fetching destination ETA:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // Get Port Calls
  fastify.get('/api/port-calls', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { voyageId } = request.query as any;

      if (!voyageId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'voyageId is required',
        });
      }

      const data = await dbService.getPortCalls(voyageId);

      return reply.send({
        success: true,
        data: data || [],
        count: data?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching port calls:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // Get Services
  fastify.get('/api/services', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { carrier } = request.query as any;

      if (!carrier) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'carrier query parameter is required',
        });
      }

      const carrierId = await dbService.getCarrierIdByName(carrier);

      if (!carrierId) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Carrier '${carrier}' not found`,
        });
      }

      const services = await dbService.getServicesByCarrier(carrierId);

      return reply.send({
        success: true,
        data: services || [],
        count: services?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching services:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  // ============================================
  // COMBINED ENDPOINTS: RATES + SCHEDULES
  // ============================================

  // Search Rates with Next Departures
  fastify.post('/api/search-rates-with-schedules', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { pol_code, pod_code, container_type, vendor_name } = request.body as any;

      // Get rates (existing logic)
      let query = supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('pol_code', pol_code)
        .eq('pod_code', pod_code);

      if (container_type) {
        query = query.eq('container_type', container_type);
      }
      if (vendor_name) {
        query = query.ilike('vendor', `%${vendor_name}%`);
      }

      const { data: rates, error: ratesError } = await query;

      if (ratesError) throw ratesError;

      // For each rate, get next departure
      const ratesWithSchedules = await Promise.all(
        (rates || []).map(async (rate: any) => {
          // Get origin location ID for this rate
          const { data: location } = await supabase
            .from('locations')
            .select('id')
            .eq('unlocode', pol_code)
            .single();

          if (!location?.id) {
            return { ...rate, next_departure: null };
          }

          // Get next departure for this carrier from origin
          const nextDepartures = await dbService.getNextDepartures(location.id, 5);
          const departure = nextDepartures.find(
            (d: any) => d.carrier_name?.toLowerCase() === rate.vendor?.toLowerCase()
          );

          return {
            ...rate,
            next_departure: departure ? {
              etd: departure.etd,
              planned_departure: departure.planned_departure,
              carrier_service_code: departure.carrier_service_code,
              carrier_voyage_number: departure.carrier_voyage_number,
              vessel_name: departure.vessel_name,
            } : null,
          };
        })
      );

      return reply.send({
        success: true,
        data: ratesWithSchedules,
        count: ratesWithSchedules.length,
      });
    } catch (error: any) {
      console.error('Error fetching rates with schedules:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });
}


