/**
 * Schedule Metrics/Reporting Routes
 * Provides analytics on schedule data sources (Database, Line API, Portcast)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Add schedule metrics/reporting routes to Fastify server
 */
export function addScheduleMetricsRoutes(
  fastify: FastifyInstance,
  supabase: SupabaseClient
) {
  /**
   * API Key authentication
   */
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
  // SCHEDULE METRICS ENDPOINTS
  // ============================================

  /**
   * Get schedule source statistics for a specific search
   * POST /api/v4/schedules/metrics
   * 
   * Analyzes the source distribution of schedules returned by a search
   */
  fastify.post('/api/v4/schedules/metrics', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        origin,
        destination,
        departure_from,
        departure_to,
        weeks,
        limit
      } = request.body as any;

      if (!origin) {
        return reply.code(400).send({
          success: false,
          error: 'origin is required',
        });
      }

      // Import the schedule service to get the actual schedules
      const { ScheduleIntegrationService } = await import('../services/schedule-integration.service.js');
      const scheduleService = new ScheduleIntegrationService(supabase);

      // Parse dates
      const parseDate = (value: string): string | null => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
      };

      let departureFromISO: string | undefined = parseDate(departure_from || '') || undefined;
      let departureToISO: string | undefined = parseDate(departure_to || '') || undefined;

      if (weeks !== undefined && departureFromISO) {
        const weeksNum = Number(weeks);
        if (!Number.isNaN(weeksNum) && weeksNum > 0) {
          const fromDate = new Date(`${departureFromISO}T00:00:00Z`);
          fromDate.setDate(fromDate.getDate() + (weeksNum * 7));
          departureToISO = fromDate.toISOString().split('T')[0];
        }
      }

      if (!departureFromISO) {
        departureFromISO = new Date().toISOString().split('T')[0];
      }

      const numericLimit = limit !== undefined ? Number(limit) : 100;

      // Get schedules
      const schedules = await scheduleService.searchSchedules(origin, {
        destination,
        departureFrom: departureFromISO,
        departureTo: departureToISO,
        limit: numericLimit,
      });

      // Count by source
      const sourceStats = {
        database: 0,
        portcast: 0,
        maersk: 0,
        unknown: 0,
        total: schedules.length
      };

      for (const schedule of schedules) {
        switch (schedule.source?.toLowerCase()) {
          case 'database':
            sourceStats.database++;
            break;
          case 'portcast':
            sourceStats.portcast++;
            break;
          case 'maersk':
            sourceStats.maersk++;
            break;
          default:
            sourceStats.unknown++;
        }
      }

      // Calculate percentages
      const percentages = {
        database: sourceStats.total > 0 ? (sourceStats.database / sourceStats.total * 100).toFixed(2) : '0.00',
        portcast: sourceStats.total > 0 ? (sourceStats.portcast / sourceStats.total * 100).toFixed(2) : '0.00',
        maersk: sourceStats.total > 0 ? (sourceStats.maersk / sourceStats.total * 100).toFixed(2) : '0.00',
        unknown: sourceStats.total > 0 ? (sourceStats.unknown / sourceStats.total * 100).toFixed(2) : '0.00'
      };

      return reply.send({
        success: true,
        data: {
          counts: sourceStats,
          percentages,
          breakdown: {
            from_database: sourceStats.database,
            from_line_api: sourceStats.maersk,
            from_portcast: sourceStats.portcast,
            unknown_source: sourceStats.unknown,
            total_schedules: sourceStats.total
          }
        },
        metadata: {
          api_version: 'v4',
          generated_at: new Date().toISOString(),
          search_params: {
            origin: origin.toUpperCase(),
            destination: destination ? destination.toUpperCase() : undefined,
            departure_from: departureFromISO,
            departure_to: departureToISO,
            limit: numericLimit
          }
        }
      });
    } catch (error: any) {
      console.error('Error generating schedule metrics:', error);
      return reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  /**
   * Get schedule source statistics from audit table
   * GET /api/v4/schedules/audit-stats
   * 
   * Provides historical statistics based on the schedule_source_audit table
   */
  fastify.get('/api/v4/schedules/audit-stats', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { 
        carrier,
        start_date,
        end_date,
        limit = 1000
      } = request.query as any;

      let query = supabase
        .from('schedule_source_audit')
        .select('source_system, carrier_id, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(limit) || 1000, 10000));

      // Filter by date range if provided
      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data: auditRecords, error } = await query;

      if (error) throw error;

      // Get carrier names if carrier filter provided
      let carrierIds: string[] | null = null;
      if (carrier) {
        const { data: carriers } = await supabase
          .from('carrier')
          .select('id')
          .ilike('name', `%${carrier}%`);
        
        carrierIds = carriers?.map(c => c.id) || [];
        if (carrierIds.length === 0) {
          return reply.send({
            success: true,
            data: {
              counts: { database: 0, portcast: 0, maersk: 0, unknown: 0, total: 0 },
              percentages: { database: '0.00', portcast: '0.00', maersk: '0.00', unknown: '0.00' },
              breakdown: {
                from_database: 0,
                from_line_api: 0,
                from_portcast: 0,
                unknown_source: 0,
                total_schedules: 0
              }
            },
            metadata: {
              api_version: 'v4',
              generated_at: new Date().toISOString(),
              message: `No records found for carrier: ${carrier}`
            }
          });
        }
      }

      // Filter by carrier if specified
      const filteredRecords = carrierIds 
        ? (auditRecords || []).filter(record => carrierIds!.includes(record.carrier_id))
        : (auditRecords || []);

      // Count by source
      const sourceStats = {
        database: 0,
        portcast: 0,
        maersk: 0,
        unknown: 0,
        total: filteredRecords.length
      };

      for (const record of filteredRecords) {
        const source = (record.source_system || '').toLowerCase();
        switch (source) {
          case 'database':
          case 'db':
            sourceStats.database++;
            break;
          case 'portcast':
            sourceStats.portcast++;
            break;
          case 'maersk':
          case 'dcsa':
            sourceStats.maersk++;
            break;
          default:
            sourceStats.unknown++;
        }
      }

      // Calculate percentages
      const percentages = {
        database: sourceStats.total > 0 ? (sourceStats.database / sourceStats.total * 100).toFixed(2) : '0.00',
        portcast: sourceStats.total > 0 ? (sourceStats.portcast / sourceStats.total * 100).toFixed(2) : '0.00',
        maersk: sourceStats.total > 0 ? (sourceStats.maersk / sourceStats.total * 100).toFixed(2) : '0.00',
        unknown: sourceStats.total > 0 ? (sourceStats.unknown / sourceStats.total * 100).toFixed(2) : '0.00'
      };

      return reply.send({
        success: true,
        data: {
          counts: sourceStats,
          percentages,
          breakdown: {
            from_database: sourceStats.database,
            from_line_api: sourceStats.maersk,
            from_portcast: sourceStats.portcast,
            unknown_source: sourceStats.unknown,
            total_schedules: sourceStats.total
          }
        },
        metadata: {
          api_version: 'v4',
          generated_at: new Date().toISOString(),
          filters: {
            carrier: carrier || 'all',
            start_date: start_date || 'all',
            end_date: end_date || 'all',
            record_limit: Number(limit)
          },
          note: 'Statistics based on schedule_source_audit table. This tracks schedule ingestion, not search results.'
        }
      });
    } catch (error: any) {
      console.error('Error fetching audit stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });

  /**
   * Get carrier-wise schedule source breakdown
   * GET /api/v4/schedules/carrier-breakdown
   */
  fastify.get('/api/v4/schedules/carrier-breakdown', {
    preHandler: [authenticateApiKey]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { start_date, end_date } = request.query as any;

      let query = supabase
        .from('schedule_source_audit')
        .select('source_system, carrier_id')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }

      const { data: auditRecords, error } = await query;

      if (error) throw error;

      // Get all unique carrier IDs
      const carrierIds = [...new Set((auditRecords || []).map(r => r.carrier_id))];

      // Get carrier names
      const { data: carriers } = await supabase
        .from('carrier')
        .select('id, name')
        .in('id', carrierIds);

      const carrierMap = new Map(
        (carriers || []).map(c => [c.id, c.name])
      );

      // Group by carrier and source
      const breakdown: Record<string, {
        carrier_name: string;
        database: number;
        portcast: number;
        maersk: number;
        unknown: number;
        total: number;
      }> = {};

      for (const record of (auditRecords || [])) {
        const carrierName = carrierMap.get(record.carrier_id) || 'Unknown Carrier';
        
        if (!breakdown[record.carrier_id]) {
          breakdown[record.carrier_id] = {
            carrier_name: carrierName,
            database: 0,
            portcast: 0,
            maersk: 0,
            unknown: 0,
            total: 0
          };
        }

        const source = (record.source_system || '').toLowerCase();
        switch (source) {
          case 'database':
          case 'db':
            breakdown[record.carrier_id].database++;
            break;
          case 'portcast':
            breakdown[record.carrier_id].portcast++;
            break;
          case 'maersk':
          case 'dcsa':
            breakdown[record.carrier_id].maersk++;
            break;
          default:
            breakdown[record.carrier_id].unknown++;
        }
        breakdown[record.carrier_id].total++;
      }

      return reply.send({
        success: true,
        data: Object.values(breakdown).sort((a, b) => b.total - a.total),
        metadata: {
          api_version: 'v4',
          generated_at: new Date().toISOString(),
          filters: {
            start_date: start_date || 'all',
            end_date: end_date || 'all'
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching carrier breakdown:', error);
      return reply.code(500).send({
        success: false,
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
      });
    }
  });
}

