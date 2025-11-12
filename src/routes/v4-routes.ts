/**
 * V4 API Routes
 * New version of search-rates and prepare-quote APIs with:
 * - origin/destination field names (instead of pol_code/pod_code)
 * - Automatic inland haulage detection and inclusion
 * - Earliest departure from Maersk schedules
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ScheduleIntegrationService } from '../services/schedule-integration.service.js';
import type { EarliestDeparture } from '../services/schedule-integration.service.js';

/**
 * Add V4 API routes to Fastify server
 */
export function addV4Routes(
  fastify: FastifyInstance,
  supabase: SupabaseClient
) {
  const scheduleService = new ScheduleIntegrationService(supabase);

  /**
   * Helper: Build query with origin/destination support
   * Uses origin_code/destination_code columns (after migration)
   */
  const buildOriginDestinationQuery = (baseQuery: any, origin: string, destination: string) => {
    // Use origin_code/destination_code columns (migration completed)
    return baseQuery.eq('origin_code', origin.toUpperCase())
                    .eq('destination_code', destination.toUpperCase());
  };

  // ============================================
  // V4 SCHEDULE SEARCH (Independent of rates)
  // ============================================

  fastify.post('/api/v4/schedules/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        origin,
        destination,
        cargo_ready_date,
        carrier,
        service_code,
        vessel_name,
        voyage,
        limit,
      } = request.body as any;

      if (!origin) {
        return reply.code(400).send({
          success: false,
          error: 'origin is required',
        });
      }

      let cargoReadyDateISO: string | undefined;
      if (cargo_ready_date) {
        const cargoReadyDate = new Date(cargo_ready_date);
        if (Number.isNaN(cargoReadyDate.getTime())) {
          return reply.code(400).send({
            success: false,
            error: 'cargo_ready_date must be a valid ISO date string (YYYY-MM-DD)',
          });
        }
        cargoReadyDateISO = cargoReadyDate.toISOString().split('T')[0];
      } else {
        cargoReadyDateISO = new Date().toISOString().split('T')[0];
      }

      let numericLimit: number | undefined;
      if (limit !== undefined) {
        numericLimit = Number(limit);
        if (Number.isNaN(numericLimit) || numericLimit < 1) {
          return reply.code(400).send({
            success: false,
            error: 'limit must be a positive number',
          });
        }
      }

      const schedules = await scheduleService.searchSchedules(origin, {
        destination,
        cargoReadyDate: cargoReadyDateISO,
        carrier,
        serviceCode: service_code,
        vesselName: vessel_name,
        voyage,
        limit: numericLimit,
      });

      return {
        success: true,
        data: schedules,
        message: schedules.length === 0 ? 'No schedules found' : undefined,
        metadata: {
          api_version: 'v4',
          generated_at: new Date().toISOString(),
          origin: origin.toUpperCase(),
          destination: destination ? destination.toUpperCase() : undefined,
          cargo_ready_date: cargoReadyDateISO,
          carrier: carrier || undefined,
          service_code: service_code || undefined,
          vessel_name: vessel_name || undefined,
          voyage: voyage || undefined,
        },
      };
    } catch (error) {
      console.error('V4 Schedule Search Error:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  });

  // ============================================
  // V4 SEARCH RATES
  // ============================================

  fastify.post('/api/v4/search-rates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        origin,
        destination,
        container_type,
        vendor_name,
        cargo_weight_mt,
        haulage_type,
        include_earliest_departure = false,
        cargo_ready_date
      } = request.body as any;

      // Validate required fields
      if (!origin || !destination) {
        return reply.code(400).send({
          success: false,
          error: 'origin and destination are required'
        });
      }

      // Check if ports are inland (automatic detection)
      const { originIsInland, destinationIsInland } = await scheduleService.checkInlandPorts(
        origin,
        destination
      );

      // If inland detected, validate required parameters
      if ((originIsInland || destinationIsInland) && (!cargo_weight_mt || !haulage_type)) {
        return reply.code(400).send({
          success: false,
          error: 'cargo_weight_mt and haulage_type are required when origin or destination is an inland port (ICD)'
        });
      }

      // Determine cargo readiness date (defaults to today)
      let cargoReadyDate: Date;
      if (cargo_ready_date) {
        cargoReadyDate = new Date(cargo_ready_date);
        if (Number.isNaN(cargoReadyDate.getTime())) {
          return reply.code(400).send({
            success: false,
            error: 'cargo_ready_date must be a valid ISO date string (YYYY-MM-DD)'
          });
        }
      } else {
        cargoReadyDate = new Date();
      }
      const cargoReadyDateISO = cargoReadyDate.toISOString().split('T')[0];

      // Query rates using origin/destination
      let query = buildOriginDestinationQuery(
        supabase.from('mv_freight_sell_prices').select('*'),
        origin,
        destination
      )
        .lte('valid_from', cargoReadyDateISO)
        .gte('valid_to', cargoReadyDateISO);

      if (container_type) {
        query = query.eq('container_type', container_type);
      }

      if (vendor_name) {
        query = query.ilike('carrier', `%${vendor_name}%`);
      }

      const { data: rates, error: ratesError } = await query;

      if (ratesError) {
        throw ratesError;
      }

      if (!rates || rates.length === 0) {
        return {
          success: true,
          data: [],
          message: `No rates found for cargo_ready_date ${cargoReadyDateISO}`,
          metadata: {
            api_version: 'v4',
            generated_at: new Date().toISOString(),
            cargo_ready_date: cargoReadyDateISO
          }
        };
      }

      // Process each rate
      const processedRates = await Promise.all(
        rates.map(async (rate: any) => {
          const carrierVendorId =
            rate.vendor_id ?? rate.vendorid ?? rate.vendorId ?? null;
          const processedRate: any = {
            vendor: rate.carrier,
            // Use origin_name/destination_name if available (after migration), otherwise pol_name/pod_name
            route: `${rate.origin_name || rate.pol_name} → ${rate.destination_name || rate.pod_name}`,
            // Return origin/destination in response (API field names)
            origin: origin.toUpperCase(),  // Always use input value (API field name)
            destination: destination.toUpperCase(),  // Always use input value (API field name)
            container_type: rate.container_type,
            transit_days: rate.transit_days,
            pricing: {
              ocean_freight_buy: rate.ocean_freight_buy,
              freight_surcharges: rate.freight_surcharges,
              all_in_freight_buy: rate.all_in_freight_buy,
              margin: {
                type: rate.margin_type,
                percentage: rate.margin_percentage,
                amount: rate.margin_amount,
              },
              all_in_freight_sell: rate.all_in_freight_sell,
              currency: rate.currency,
            },
            validity: {
              from: rate.valid_from,
              to: rate.valid_to,
            },
            is_preferred: rate.is_preferred,
            rate_id: rate.rate_id,
          };

          // Automatic inland haulage (if inland detected)
          if (originIsInland || destinationIsInland) {
            try {
              const { data: haulageResult, error: haulageError } = await supabase.rpc(
                'simplified_inland_function',
                {
                  p_pol_code: origin.toUpperCase(),
                  p_pod_code: destination.toUpperCase(),
                  p_container_type: container_type || rate.container_type,
                  p_container_count: 1,
                  p_cargo_weight_mt: cargo_weight_mt,
                  p_haulage_type: haulage_type,
                  p_vendor_id: carrierVendorId
                }
              );

              if (haulageError) {
                console.error('Inland haulage error:', haulageError);
                processedRate.inland_haulage = {
                  error: haulageError.message
                };
              } else if (haulageResult && haulageResult.success) {
                processedRate.inland_haulage = {
                  ihe_charges: haulageResult.ihe_charges || { found: false },
                  ihi_charges: haulageResult.ihi_charges || { found: false },
                  total_haulage_usd:
                    (haulageResult.ihe_charges?.total_amount_usd || 0) +
                    (haulageResult.ihi_charges?.total_amount_usd || 0)
                };
              } else {
                processedRate.inland_haulage = {
                  ihe_charges: { found: false },
                  ihi_charges: { found: false },
                  total_haulage_usd: 0
                };
              }
            } catch (error) {
              console.error('Error getting inland haulage:', error);
              processedRate.inland_haulage = {
                error: error instanceof Error ? error.message : String(error)
              };
            }
          } else {
            // Not inland, no haulage needed
            processedRate.inland_haulage = {
              ihe_charges: { found: false, message: 'Origin is not inland, no IHE needed' },
              ihi_charges: { found: false, message: 'Destination is not inland, no IHI needed' },
              total_haulage_usd: 0
            };
          }

          // Earliest departure (if requested)
          if (include_earliest_departure) {
            try {
              const departureResults = await scheduleService.getEarliestDeparture(
                origin.toUpperCase(),
                rate.carrier || rate.vendor,
                destination.toUpperCase(), // Pass destination to filter correct route
                {
                  cargoReadyDate: cargoReadyDateISO
                }
              );
              processedRate.earliest_departure = departureResults.earliest;
            } catch (error) {
              console.error('Error getting earliest departure:', error);
              processedRate.earliest_departure = {
                found: false,
                message: error instanceof Error ? error.message : String(error)
              };
            }
          }

          return processedRate;
        })
      );

      return {
        success: true,
        data: processedRates,
        metadata: {
          api_version: 'v4',
          generated_at: new Date().toISOString(),
          cargo_ready_date: cargoReadyDateISO
        }
      };
    } catch (error) {
      console.error('V4 Search Rates Error:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error)
      };
    }
  });

  // ============================================
  // V4 PREPARE QUOTE
  // ============================================

  fastify.post('/api/v4/prepare-quote', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        salesforce_org_id,
        rate_id,
        container_count = 1,
        cargo_weight_mt,
        haulage_type,
        include_earliest_departure = true,
        cargo_ready_date
      } = request.body as any;

      // Validate required fields (like V2 - uses rate_id)
      if (!salesforce_org_id || !rate_id) {
        return reply.code(400).send({
          success: false,
          error: 'salesforce_org_id and rate_id are required'
        });
      }

      // Validate container_count if provided
      if (container_count && (container_count < 1 || container_count > 10)) {
        return reply.code(400).send({
          success: false,
          error: 'container_count must be between 1 and 10'
        });
      }

      // Determine cargo readiness date (defaults to today)
      let cargoReadyDate: Date;
      if (cargo_ready_date) {
        cargoReadyDate = new Date(cargo_ready_date);
        if (Number.isNaN(cargoReadyDate.getTime())) {
          return reply.code(400).send({
            success: false,
            error: 'cargo_ready_date must be a valid ISO date string (YYYY-MM-DD)'
          });
        }
      } else {
        cargoReadyDate = new Date();
      }
      const cargoReadyDateISO = cargoReadyDate.toISOString().split('T')[0];

      // Get rate by rate_id (like V2)
      const { data: rateData, error: rateError } = await supabase
        .from('mv_freight_sell_prices')
        .select('*')
        .eq('rate_id', rate_id)
        .single();

      if (rateError || !rateData) {
        return reply.code(404).send({
          success: false,
          error: 'Rate not found'
        });
      }

      // Ensure cargo ready date falls within rate validity
      if (
        (rateData.valid_from && cargoReadyDateISO < rateData.valid_from) ||
        (rateData.valid_to && cargoReadyDateISO > rateData.valid_to)
      ) {
        return reply.code(400).send({
          success: false,
          error: `Rate ${rate_id} is not valid for cargo_ready_date ${cargoReadyDateISO}`
        });
      }

      // Get origin/destination from rate data (for inland detection and response)
      const origin = rateData.origin_code || rateData.pol_code;
      const destination = rateData.destination_code || rateData.pod_code;
      const container_type = rateData.container_type;

      // Check if ports are inland (automatic detection)
      const { originIsInland, destinationIsInland } = await scheduleService.checkInlandPorts(
        origin,
        destination
      );

      // If inland detected, validate required parameters
      if ((originIsInland || destinationIsInland) && (!cargo_weight_mt || !haulage_type)) {
        return reply.code(400).send({
          success: false,
          error: 'cargo_weight_mt and haulage_type are required when origin or destination is an inland port (ICD)'
        });
      }

      // Rate found - continue with quote preparation

      // Get local charges (same logic as V1)
      const contractId = rateData.contract_id;
      const polId = rateData.pol_id;
      const podId = rateData.pod_id;
      const vendorId = rateData.vendor_id ?? null;

      // Get Origin Charges (same logic as V2)
      const { data: originChargesRaw, error: originError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .eq('pol_id', polId)
        .eq('charge_location_type', 'Origin Charges')
        .eq('applies_scope', 'origin')
        .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

      // Get Destination Charges (same logic as V2)
      const { data: destChargesRaw, error: destError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .eq('pod_id', podId)
        .eq('charge_location_type', 'Destination Charges')
        .eq('applies_scope', 'dest')
        .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

      // Get Other Charges (same logic as V2)
      const { data: otherChargesRaw, error: otherError } = await supabase
        .from('v_local_charges_details')
        .select('*')
        .eq('contract_id', contractId)
        .not('charge_location_type', 'in', '(Origin Charges,Destination Charges)')
        .or(`surcharge_container_type.eq.${container_type},surcharge_container_type.is.null`);

      // Deduplicate charges
      const deduplicateCharges = (charges: any[]) => {
        const seen = new Set();
        return charges?.filter((charge: any) => {
          if (seen.has(charge.charge_code)) {
            return false;
          }
          seen.add(charge.charge_code);
          return true;
        }) || [];
      };

      const originCharges = deduplicateCharges(originChargesRaw || []);
      const destCharges = deduplicateCharges(destChargesRaw || []);
      const otherCharges = deduplicateCharges(otherChargesRaw || []);

      // Get FX rates
      const currencies = [...new Set([
        ...(originCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
        ...(destCharges?.map((c: any) => c.charge_currency).filter(Boolean) || []),
        ...(otherCharges?.map((c: any) => c.charge_currency).filter(Boolean) || [])
      ])].filter(c => c !== 'USD');

      let fxRates: { [key: string]: number } = {};
      if (currencies.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const { data: fxData, error: fxError } = await supabase
          .from('fx_rate')
          .select('rate_date, base_ccy, quote_ccy, rate')
          .eq('rate_date', today)
          .eq('quote_ccy', 'USD')
          .in('base_ccy', currencies);

        if (!fxError && fxData) {
          fxData.forEach((fx: any) => {
            fxRates[fx.base_ccy] = fx.rate;
          });
        }

        // Fallback rates if not in database
        const fallbackRates: { [key: string]: number } = {
          INR: 0.012048,
          EUR: 1.176471,
          AED: 0.272480,
          GBP: 1.369863,
          JPY: 0.009091,
          CNY: 0.138889
        };

        currencies.forEach((ccy: string) => {
          if (!fxRates[ccy] && fallbackRates[ccy]) {
            fxRates[ccy] = fallbackRates[ccy];
          }
        });
      }

      // Calculate totals
      const calculateTotal = (charges: any[], multiplier: number = 1) => {
        let totalLocal = 0;
        let totalUSD = 0;

        charges.forEach((charge: any) => {
          const amount = charge.charge_amount || 0;
          const currency = charge.charge_currency || 'USD';
          totalLocal += amount * multiplier;

          if (currency === 'USD') {
            totalUSD += amount * multiplier;
          } else {
            const rate = fxRates[currency] || 1;
            totalUSD += amount * rate * multiplier;
          }
        });

        return {
          total_local: Math.round(totalLocal * 100) / 100,
          total_usd: Math.round(totalUSD * 100) / 100
        };
      };

      const originTotals = calculateTotal(originCharges, container_count);
      const destTotals = calculateTotal(destCharges, container_count);
      const otherTotals = calculateTotal(otherCharges, container_count);
      const oceanFreightSell = (rateData.all_in_freight_sell || 0) * container_count;

      // Automatic inland haulage (if inland detected)
      let inlandHaulageTotalUSD = 0;
      let inlandHaulageDetails: any = {
        ihe_charges: { found: false, message: 'Origin is not inland, no IHE needed' },
        ihi_charges: { found: false, message: 'Destination is not inland, no IHI needed' },
        total_haulage_usd: 0
      };

      if (originIsInland || destinationIsInland) {
        try {
          const { data: haulageResult, error: haulageError } = await supabase.rpc(
            'simplified_inland_function',
            {
              p_pol_code: (rateData.origin_code || rateData.pol_code || origin).toUpperCase(),
              p_pod_code: (rateData.destination_code || rateData.pod_code || destination).toUpperCase(),
              p_container_type: rateData.container_type,
              p_container_count: container_count,
              p_cargo_weight_mt: cargo_weight_mt,
              p_haulage_type: haulage_type,
              p_vendor_id: vendorId
            }
          );

          if (haulageError) {
            console.error('Inland haulage error:', haulageError);
            inlandHaulageDetails = {
              error: haulageError.message
            };
          } else if (haulageResult && haulageResult.success) {
            inlandHaulageDetails = {
              ihe_charges: haulageResult.ihe_charges || { found: false },
              ihi_charges: haulageResult.ihi_charges || { found: false },
              total_haulage_usd:
                (haulageResult.ihe_charges?.total_amount_usd || 0) +
                (haulageResult.ihi_charges?.total_amount_usd || 0)
            };
            inlandHaulageTotalUSD = inlandHaulageDetails.total_haulage_usd;
          }
        } catch (error) {
          console.error('Error getting inland haulage:', error);
          inlandHaulageDetails = {
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }

      // Earliest departure (if requested)
      let earliestDeparture: EarliestDeparture | null = null;
      let upcomingDepartures: EarliestDeparture[] = [];
      if (include_earliest_departure && rateData.carrier) {
        try {
          const departureResults = await scheduleService.getEarliestDeparture(
            (rateData.origin_code || rateData.pol_code || origin).toUpperCase(),
            rateData.carrier,
            (rateData.destination_code || rateData.pod_code || destination).toUpperCase(),
            {
              cargoReadyDate: cargoReadyDateISO,
              includeUpcoming: true,
              upcomingLimit: 4,
              rateValidTo: rateData.valid_to,
            }
          );
          earliestDeparture = departureResults.earliest;
          upcomingDepartures = departureResults.upcoming.slice(0, 4);
        } catch (error) {
          console.error('Error getting earliest departure:', error);
          earliestDeparture = {
            found: false,
            carrier: rateData.carrier,
            message: error instanceof Error ? error.message : String(error)
          };
        }
      }

      // Calculate grand total
      const grandTotalUSD = oceanFreightSell +
        originTotals.total_usd +
        destTotals.total_usd +
        otherTotals.total_usd +
        inlandHaulageTotalUSD;

      const scheduleSummary = include_earliest_departure
        ? {
            earliest_departure: earliestDeparture,
            upcoming_departures: upcomingDepartures,
          }
        : {};

      return {
        success: true,
        data: {
          salesforce_org_id,
          route: {
            // Return origin/destination from rate data (API field names)
            origin: (rateData.origin_code || rateData.pol_code || origin).toUpperCase(),
            destination: (rateData.destination_code || rateData.pod_code || destination).toUpperCase(),
            container_type: rateData.container_type,
            container_count
          },
          quote_parts: {
            ocean_freight: {
              carrier: rateData.carrier || 'N/A',
              all_in_freight_sell: rateData.all_in_freight_sell,
              ocean_freight_buy: rateData.ocean_freight_buy,
              freight_surcharges: rateData.freight_surcharges,
              margin: {
                type: rateData.margin_type,
                percentage: rateData.margin_percentage,
                amount: rateData.margin_amount,
              },
              currency: rateData.currency,
              transit_days: rateData.transit_days,
              validity: {
                from: rateData.valid_from,
                to: rateData.valid_to,
              },
              is_preferred: rateData.is_preferred,
              rate_id: rateData.rate_id,
            },
            origin_charges: {
              charges: originCharges.map((c: any) => ({
                charge_name: c.vendor_charge_name,
                charge_code: c.charge_code,
                charge_amount: c.charge_amount,
                charge_currency: c.charge_currency,
                amount_usd: c.charge_currency === 'USD'
                  ? c.charge_amount
                  : (c.charge_amount * (fxRates[c.charge_currency] || 1)),
                uom: c.uom
              })),
              total_local: originTotals.total_local,
              total_usd: originTotals.total_usd,
              count: originCharges.length
            },
            destination_charges: {
              charges: destCharges.map((c: any) => ({
                charge_name: c.vendor_charge_name,
                charge_code: c.charge_code,
                charge_amount: c.charge_amount,
                charge_currency: c.charge_currency,
                amount_usd: c.charge_currency === 'USD'
                  ? c.charge_amount
                  : (c.charge_amount * (fxRates[c.charge_currency] || 1)),
                uom: c.uom
              })),
              total_local: destTotals.total_local,
              total_usd: destTotals.total_usd,
              count: destCharges.length
            },
            other_charges: {
              charges: otherCharges.map((c: any) => ({
                charge_name: c.vendor_charge_name,
                charge_code: c.charge_code,
                charge_amount: c.charge_amount,
                charge_currency: c.charge_currency,
                amount_usd: c.charge_currency === 'USD'
                  ? c.charge_amount
                  : (c.charge_amount * (fxRates[c.charge_currency] || 1)),
                uom: c.uom
              })),
              total_local: otherTotals.total_local,
              total_usd: otherTotals.total_usd,
              count: otherCharges.length
            }
          },
          totals: {
            ocean_freight_total: oceanFreightSell,
            origin_total_local: originTotals.total_local,
            origin_total_usd: originTotals.total_usd,
            destination_total_local: destTotals.total_local,
            destination_total_usd: destTotals.total_usd,
            other_total_local: otherTotals.total_local,
            other_total_usd: otherTotals.total_usd,
            inland_haulage_total_usd: inlandHaulageTotalUSD,
            grand_total_usd: Math.round(grandTotalUSD * 100) / 100,
            currency: 'USD',
            fx_rates: fxRates,
            currencies_used: currencies
          },
          quote_summary: {
            route_display: `${rateData.origin_name || rateData.pol_name || 'N/A'} (${rateData.origin_code || rateData.pol_code || 'N/A'}) → ${rateData.destination_name || rateData.pod_name || 'N/A'} (${rateData.destination_code || rateData.pod_code || 'N/A'})`,
            container_info: `${container_count}x ${rateData.container_type}`,
            total_charges_breakdown: {
              ocean_freight_usd: oceanFreightSell,
              local_charges_usd: originTotals.total_usd + destTotals.total_usd + otherTotals.total_usd,
              inland_haulage_usd: inlandHaulageTotalUSD
            },
            vendor_info: {
              carrier: rateData.carrier || 'N/A',
              transit_days: rateData.transit_days || 0
            },
            currency_conversion: {
              fx_rates_applied: fxRates,
              fx_date: new Date().toISOString().split('T')[0],
              currencies_converted: currencies
            }
          },
          inland_haulage: inlandHaulageDetails,
          ...scheduleSummary,
          metadata: {
            generated_at: new Date().toISOString(),
            origin: (rateData.origin_code || rateData.pol_code || origin).toUpperCase(),
            destination: (rateData.destination_code || rateData.pod_code || destination).toUpperCase(),
            container_type: rateData.container_type,
            container_count,
            rate_id,
            api_version: 'v4',
            cargo_ready_date: cargoReadyDateISO
          }
        }
      };
    } catch (error) {
      console.error('V4 Prepare Quote Error:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error)
      };
    }
  });
}

