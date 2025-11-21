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
        departure_from, // Start date for departure range
        departure_to, // End date for departure range
        weeks, // Number of weeks from departure_from (2, 4, or 6) - LWC will calculate
        limit, // Max number of results (default higher for client-side filtering)
      } = request.body as any;

      if (!origin) {
        return reply.code(400).send({
          success: false,
          error: 'origin is required',
        });
      }

      // Simple date range handling - LWC will do all other filtering
      const parseDate = (value: string, fieldName: string): string | null => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          reply.code(400).send({
            success: false,
            error: `${fieldName} must be a valid ISO date string (YYYY-MM-DD)`,
          });
          return null;
        }
        return parsed.toISOString().split('T')[0];
      };

      let departureFromISO: string | undefined;
      let departureToISO: string | undefined;

      if (departure_from) {
        const parsed = parseDate(departure_from, 'departure_from');
        if (!parsed) {
          return;
        }
        departureFromISO = parsed;
      }

      // Calculate departure_to from weeks if provided (LWC convenience)
      if (weeks !== undefined && departureFromISO) {
        const weeksNum = Number(weeks);
        if (!Number.isNaN(weeksNum) && weeksNum > 0) {
          const fromDate = new Date(`${departureFromISO}T00:00:00Z`);
          fromDate.setDate(fromDate.getDate() + (weeksNum * 7));
          departureToISO = fromDate.toISOString().split('T')[0];
        }
      } else if (departure_to) {
        const parsed = parseDate(departure_to, 'departure_to');
        if (!parsed) {
          return;
        }
        departureToISO = parsed;
      }

      // Default to today if no date provided
      if (!departureFromISO) {
        departureFromISO = new Date().toISOString().split('T')[0];
      }

      // Validate date range
      if (departureFromISO && departureToISO) {
        const fromTime = new Date(`${departureFromISO}T00:00:00Z`).getTime();
        const toTime = new Date(`${departureToISO}T23:59:59Z`).getTime();
        if (toTime < fromTime) {
          return reply.code(400).send({
            success: false,
            error: 'departure_to must be greater than or equal to departure_from',
          });
        }
      }

      // Higher default limit for client-side filtering (LWC will filter further)
      let numericLimit: number | undefined = limit !== undefined ? Number(limit) : 100;
      if (limit !== undefined) {
        if (Number.isNaN(numericLimit) || numericLimit < 1) {
          return reply.code(400).send({
            success: false,
            error: 'limit must be a positive number',
          });
        }
      }

      // Simple API - just return schedules in date range, LWC does all filtering
      const schedules = await scheduleService.searchSchedules(origin, {
        destination,
        departureFrom: departureFromISO,
        departureTo: departureToISO,
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
          departure_from: departureFromISO,
          departure_to: departureToISO,
          total_results: schedules.length,
          note: 'All filtering (carrier, service, vessel, voyage, is_direct, arrival dates) should be done client-side in the LWC',
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
      // Check includes_inland_haulage to handle 3 pricing models
      let inlandHaulageTotalUSD = 0;
      let inlandHaulageDetails: any = {
        ihe_charges: { found: false, message: 'Origin is not inland, no IHE needed' },
        ihi_charges: { found: false, message: 'Destination is not inland, no IHI needed' },
        total_haulage_usd: 0,
        pricing_model: 'gateway_port' // Default
      };

      const haulageConfig = rateData.includes_inland_haulage;

      if (originIsInland || destinationIsInland) {
        // Determine pricing model
        let pricingModel = 'gateway_port'; // Default: traditional port-to-port + separate IHE
        let shouldCalculateIHE = originIsInland;
        let shouldCalculateIHI = destinationIsInland;

        if (haulageConfig) {
          pricingModel = haulageConfig.pricing_model || 'gateway_port';

          // Handle IHE (Inland Haulage Export)
          if (originIsInland) {
            if (pricingModel === 'all_inclusive' && haulageConfig.ihe_included) {
              // IHE is bundled in ocean rate - DO NOT add separate charge
              shouldCalculateIHE = false;
              inlandHaulageDetails.ihe_charges = {
                found: false,
                message: 'IHE included in ocean freight rate (all-inclusive pricing)',
                pricing_model: 'all_inclusive',
                bundled: true
              };
              console.log('⚠️ [INLAND HAULAGE] IHE bundled in ocean rate - skipping separate charge');
            } else if (pricingModel === 'inland_origin') {
              // Ocean rate is from inland, but IHE charged separately
              shouldCalculateIHE = true;
              console.log('ℹ️ [INLAND HAULAGE] Inland origin pricing - IHE will be added separately');
            }
          }

          // Handle IHI (Inland Haulage Import) - same logic
          if (destinationIsInland) {
            if (pricingModel === 'all_inclusive' && haulageConfig.ihi_included) {
              shouldCalculateIHI = false;
              inlandHaulageDetails.ihi_charges = {
                found: false,
                message: 'IHI included in ocean freight rate (all-inclusive pricing)',
                pricing_model: 'all_inclusive',
                bundled: true
              };
              console.log('⚠️ [INLAND HAULAGE] IHI bundled in ocean rate - skipping separate charge');
            }
          }
        }

        // Calculate inland haulage only if not bundled
        if (shouldCalculateIHE || shouldCalculateIHI) {
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
              inlandHaulageDetails.error = haulageError.message;
            } else if (haulageResult && haulageResult.success) {
              // Only include charges that should be calculated
              const iheCharges = shouldCalculateIHE ? haulageResult.ihe_charges : { found: false, message: 'IHE bundled in ocean rate' };
              const ihiCharges = shouldCalculateIHI ? haulageResult.ihi_charges : { found: false, message: 'IHI bundled in ocean rate' };

              inlandHaulageDetails = {
                ihe_charges: iheCharges || { found: false },
                ihi_charges: ihiCharges || { found: false },
                total_haulage_usd:
                  (shouldCalculateIHE ? (haulageResult.ihe_charges?.total_amount_usd || 0) : 0) +
                  (shouldCalculateIHI ? (haulageResult.ihi_charges?.total_amount_usd || 0) : 0),
                pricing_model: pricingModel,
                notes: pricingModel === 'all_inclusive' 
                  ? 'Some haulage charges are included in ocean freight rate'
                  : pricingModel === 'inland_origin'
                  ? 'Ocean rate priced from inland point, haulage billed separately'
                  : 'Traditional gateway port pricing with separate haulage'
              };
              inlandHaulageTotalUSD = inlandHaulageDetails.total_haulage_usd;

              console.log('✅ [INLAND HAULAGE] Calculated:', {
                pricing_model: pricingModel,
                ihe_amount: shouldCalculateIHE ? haulageResult.ihe_charges?.total_amount_usd : 'bundled',
                ihi_amount: shouldCalculateIHI ? haulageResult.ihi_charges?.total_amount_usd : 'bundled',
                total: inlandHaulageTotalUSD
              });
            }
          } catch (error) {
            console.error('Error getting inland haulage:', error);
            inlandHaulageDetails.error = error instanceof Error ? error.message : String(error);
          }
        } else {
          // All haulage is bundled
          inlandHaulageDetails.pricing_model = pricingModel;
          inlandHaulageDetails.total_haulage_usd = 0;
          console.log('ℹ️ [INLAND HAULAGE] All charges bundled in ocean rate');
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

  // ============================================
  // LCL SEARCH RATES
  // ============================================

  fastify.post('/api/v4/search-lcl-rates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        origin_code,
        destination_code,
        items, // Array of shipment items with dimensions and weights
        service_type, // optional: DIRECT, CONSOLIDATED
        vendor_ids, // optional: filter by specific vendors
        valid_date // optional: defaults to today
      } = request.body as any;

      console.log('🔍 [LCL SEARCH] Request:', {
        origin_code,
        destination_code,
        items: items?.length,
        service_type,
        vendor_ids
      });

      // Validation
      if (!origin_code || !destination_code) {
        return reply.code(400).send({
          success: false,
          error: 'origin_code and destination_code are required'
        });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'items array is required and must contain at least one item'
        });
      }

      // Calculate total volume and weight from items
      let totalVolumeCBM = 0;
      let totalWeightKG = 0;
      let totalChargeableWeightKG = 0;

      const itemDetails = items.map((item: any) => {
        // Calculate volume (L × W × H / 1,000,000)
        const volumeCBM = (item.length_cm * item.width_cm * item.height_cm) / 1000000;
        const pieces = item.pieces || 1;

        // Calculate volumetric weight (volume × 1000 for ocean)
        const volumetricWeightKG = volumeCBM * 1000;

        // Chargeable weight = MAX(actual weight, volumetric weight)
        const chargeableWeightKG = Math.max(item.gross_weight_kg, volumetricWeightKG);

        // Totals per line item
        const lineVolumeCBM = volumeCBM * pieces;
        const lineChargeableWeightKG = chargeableWeightKG * pieces;

        totalVolumeCBM += lineVolumeCBM;
        totalWeightKG += item.gross_weight_kg * pieces;
        totalChargeableWeightKG += lineChargeableWeightKG;

        return {
          ...item,
          volume_cbm: volumeCBM,
          volumetric_weight_kg: volumetricWeightKG,
          chargeable_weight_kg: chargeableWeightKG,
          total_volume_cbm: lineVolumeCBM,
          total_chargeable_weight_kg: lineChargeableWeightKG
        };
      });

      console.log('📦 [LCL SEARCH] Shipment totals:', {
        total_volume_cbm: totalVolumeCBM.toFixed(3),
        total_weight_kg: totalWeightKG.toFixed(2),
        total_chargeable_weight_kg: totalChargeableWeightKG.toFixed(2)
      });

      const tenantId = (request as any).tenant_id || '00000000-0000-0000-0000-000000000001';
      const searchDate = valid_date || new Date().toISOString().split('T')[0];

      // Find matching rates
      let rateQuery = supabase
        .from('lcl_ocean_freight_rate')
        .select(`
          *,
          vendor:vendor_id (id, name, logo_url, vendor_type)
        `)
        .eq('tenant_id', tenantId)
        .eq('origin_code', origin_code.toUpperCase())
        .eq('destination_code', destination_code.toUpperCase())
        .eq('is_active', true)
        .lte('valid_from', searchDate)
        .gte('valid_to', searchDate);

      if (service_type) {
        rateQuery = rateQuery.eq('service_type', service_type);
      }

      if (vendor_ids && Array.isArray(vendor_ids) && vendor_ids.length > 0) {
        rateQuery = rateQuery.in('vendor_id', vendor_ids);
      }

      const { data: rates, error: ratesError } = await rateQuery;

      if (ratesError) throw ratesError;

      console.log(`✅ [LCL SEARCH] Found ${rates?.length || 0} potential rates`);

      // Fetch applicable margin rules for this route
      const { data: marginRules } = await supabase
        .from('margin_rule_v2')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .lte('valid_from', searchDate)
        .gte('valid_to', searchDate)
        .or(`scope.eq.global,scope.eq.port_pair,scope.eq.trade_zone`)
        .limit(50);

      console.log(`📊 [LCL SEARCH] Found ${marginRules?.length || 0} margin rules`);

      // Match rates to shipment volume and calculate costs
      const matchedRates = [];

      for (const rate of rates || []) {
        // Check if shipment volume fits this rate
        let matched = false;
        let matchedSlab = null;

        if (rate.pricing_model === 'SLAB_BASED') {
          // For slab-based pricing, check if volume falls within this slab
          const volumeInRange =
            totalVolumeCBM >= (rate.min_volume_cbm || 0) &&
            (rate.max_volume_cbm === null || totalVolumeCBM <= rate.max_volume_cbm);

          // Also check weight limit for this slab (if specified)
          const weightWithinLimit =
            !rate.max_weight_per_slab_kg ||
            totalChargeableWeightKG <= rate.max_weight_per_slab_kg;

          if (volumeInRange && weightWithinLimit) {
            matched = true;
            matchedSlab = {
              min_volume_cbm: rate.min_volume_cbm,
              max_volume_cbm: rate.max_volume_cbm,
              rate_per_cbm: rate.rate_per_cbm,
              max_weight_per_slab_kg: rate.max_weight_per_slab_kg
            };
          }
        } else if (rate.pricing_model === 'FLAT_RATE') {
          // For flat rate, any volume is accepted
          matched = true;
          matchedSlab = {
            rate_per_cbm: rate.rate_per_cbm,
            note: 'Flat rate applies to all volumes'
          };
        }

        if (!matched) continue;

        // Calculate freight cost
        let freightCost = 0;
        if (rate.rate_basis === 'PER_CBM') {
          freightCost = totalVolumeCBM * rate.rate_per_cbm;
        } else if (rate.rate_basis === 'PER_TON') {
          freightCost = (totalChargeableWeightKG / 1000) * rate.rate_per_ton;
        } else if (rate.rate_basis === 'PER_KG') {
          freightCost = totalChargeableWeightKG * rate.rate_per_kg;
        }

        // Apply minimum charge if specified
        const minimumCharge = rate.minimum_charge || 0;
        const minimumChargeApplied = freightCost < minimumCharge;
        if (minimumChargeApplied) {
          freightCost = minimumCharge;
        }

        // Fetch surcharges for this vendor/route
        const { data: surcharges } = await supabase
          .from('lcl_surcharge')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('vendor_id', rate.vendor_id)
          .eq('is_active', true)
          .lte('valid_from', searchDate)
          .gte('valid_to', searchDate)
          .or(`origin_code.is.null,origin_code.eq.${origin_code.toUpperCase()}`)
          .or(`destination_code.is.null,destination_code.eq.${destination_code.toUpperCase()}`);

        // Calculate surcharge amounts
        let totalSurcharges = 0;
        const surchargeDetails = (surcharges || []).map((surcharge: any) => {
          let amount = 0;
          let calculation = '';

          switch (surcharge.rate_basis) {
            case 'PER_CBM':
              amount = totalVolumeCBM * surcharge.amount;
              calculation = `${totalVolumeCBM.toFixed(3)} CBM × ${surcharge.amount} ${surcharge.currency}/CBM`;
              break;
            case 'PER_TON':
              amount = (totalChargeableWeightKG / 1000) * surcharge.amount;
              calculation = `${(totalChargeableWeightKG / 1000).toFixed(2)} TON × ${surcharge.amount} ${surcharge.currency}/TON`;
              break;
            case 'PER_KG':
              amount = totalChargeableWeightKG * surcharge.amount;
              calculation = `${totalChargeableWeightKG.toFixed(2)} KG × ${surcharge.amount} ${surcharge.currency}/KG`;
              break;
            case 'PER_SHIPMENT':
            case 'FLAT':
              amount = surcharge.amount;
              calculation = `Flat charge`;
              break;
            case 'PERCENTAGE':
              amount = freightCost * (surcharge.percentage / 100);
              calculation = `${surcharge.percentage}% of ${freightCost.toFixed(2)} ${surcharge.currency}`;
              break;
          }

          // Apply min/max if specified
          if (surcharge.min_charge && amount < surcharge.min_charge) {
            amount = surcharge.min_charge;
            calculation += ` (min charge applied)`;
          }
          if (surcharge.max_charge && amount > surcharge.max_charge) {
            amount = surcharge.max_charge;
            calculation += ` (max charge applied)`;
          }

          totalSurcharges += amount;

          return {
            charge_code: surcharge.charge_code,
            charge_name: surcharge.charge_name || surcharge.charge_code,
            applies_scope: surcharge.applies_scope,
            amount: parseFloat(amount.toFixed(2)),
            calculation
          };
        });

        const totalBuyAmount = freightCost + totalSurcharges;

        // Apply margin rules
        let applicableMarginRule = null;
        let marginAmount = 0;
        let marginPercentage = 0;

        if (marginRules && marginRules.length > 0) {
          // Priority order: port_pair > trade_zone > global
          // For LCL, we'll primarily use global or mode-based rules
          const sortedRules = marginRules.sort((a: any, b: any) => {
            const scopePriority: any = { port_pair: 3, trade_zone: 2, global: 1 };
            return (scopePriority[b.scope] || 0) - (scopePriority[a.scope] || 0);
          });

          for (const rule of sortedRules) {
            let matched = false;

            if (rule.scope === 'global') {
              // Global rule applies to all
              if (!rule.mode || rule.mode === 'ocean') {
                matched = true;
              }
            } else if (rule.scope === 'port_pair') {
              // Check if origin/destination match
              if (rule.origin_id === rate.origin_code && rule.destination_id === rate.destination_code) {
                matched = true;
              }
            } else if (rule.scope === 'trade_zone') {
              // Trade zone matching would require location lookups - skip for now
              // TODO: Implement trade zone matching
            }

            if (matched) {
              applicableMarginRule = rule;
              if (rule.percentage) {
                marginPercentage = rule.percentage;
                marginAmount = totalBuyAmount * (rule.percentage / 100);
              } else if (rule.fixed_amount) {
                marginAmount = rule.fixed_amount;
                marginPercentage = (rule.fixed_amount / totalBuyAmount) * 100;
              }
              break; // Use first matching rule (highest priority)
            }
          }
        }

        const totalSellAmount = totalBuyAmount + marginAmount;

        matchedRates.push({
          rate_id: rate.id,
          vendor_id: rate.vendor_id,
          vendor_name: rate.vendor?.name,
          vendor_logo: rate.vendor?.logo_url,
          origin: origin_code.toUpperCase(),
          destination: destination_code.toUpperCase(),
          service_type: rate.service_type,
          pricing_model: rate.pricing_model,
          matched_slab: matchedSlab,
          freight_cost: parseFloat(freightCost.toFixed(2)),
          minimum_charge: minimumCharge,
          minimum_charge_applied: minimumChargeApplied,
          surcharges: surchargeDetails,
          total_surcharges: parseFloat(totalSurcharges.toFixed(2)),
          total_buy_amount: parseFloat(totalBuyAmount.toFixed(2)),
          margin: applicableMarginRule ? {
            rule_id: applicableMarginRule.id,
            rule_name: applicableMarginRule.name || `Rule ${applicableMarginRule.id}`,
            scope: applicableMarginRule.scope,
            percentage: parseFloat(marginPercentage.toFixed(2)),
            amount: parseFloat(marginAmount.toFixed(2))
          } : null,
          total_sell_amount: parseFloat(totalSellAmount.toFixed(2)),
          currency: rate.currency,
          transit_days: rate.tt_days,
          frequency: rate.frequency,
          valid_from: rate.valid_from,
          valid_to: rate.valid_to
        });
      }

      // Sort by total sell amount (cheapest first)
      matchedRates.sort((a, b) => a.total_sell_amount - b.total_sell_amount);

      console.log(`✅ [LCL SEARCH] Returning ${matchedRates.length} matched rates`);

      return reply.send({
        success: true,
        shipment_summary: {
          items: itemDetails,
          total_pieces: items.reduce((sum: number, item: any) => sum + (item.pieces || 1), 0),
          total_volume_cbm: parseFloat(totalVolumeCBM.toFixed(3)),
          total_weight_kg: parseFloat(totalWeightKG.toFixed(2)),
          total_chargeable_weight_kg: parseFloat(totalChargeableWeightKG.toFixed(2))
        },
        rates: matchedRates
      });
    } catch (error: any) {
      console.error('❌ [LCL SEARCH] Error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Failed to search LCL rates'
      });
    }
  });

  // ============================================
  // LCL PREPARE QUOTE
  // ============================================

  fastify.post('/api/v4/prepare-lcl-quote', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        enquiry_id,
        customer_id,
        rate_id, // From search-lcl-rates response
        items, // Shipment items (same as search)
        additional_surcharges, // Optional: custom surcharges
        margin_rule_id, // Optional: apply margin
        notes,
        salesforce_org_id
      } = request.body as any;

      console.log('📋 [LCL QUOTE] Request:', {
        enquiry_id,
        rate_id,
        items: items?.length,
        margin_rule_id
      });

      // Validation
      if (!rate_id) {
        return reply.code(400).send({
          success: false,
          error: 'rate_id is required'
        });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'items array is required'
        });
      }

      const tenantId = (request as any).tenant_id || '00000000-0000-0000-0000-000000000001';

      // Calculate shipment totals (same as search)
      let totalVolumeCBM = 0;
      let totalWeightKG = 0;
      let totalChargeableWeightKG = 0;

      const itemDetails = items.map((item: any) => {
        const volumeCBM = (item.length_cm * item.width_cm * item.height_cm) / 1000000;
        const pieces = item.pieces || 1;
        const volumetricWeightKG = volumeCBM * 1000;
        const chargeableWeightKG = Math.max(item.gross_weight_kg, volumetricWeightKG);

        totalVolumeCBM += volumeCBM * pieces;
        totalWeightKG += item.gross_weight_kg * pieces;
        totalChargeableWeightKG += chargeableWeightKG * pieces;

        return {
          ...item,
          volume_cbm: parseFloat(volumeCBM.toFixed(3)),
          volumetric_weight_kg: parseFloat(volumetricWeightKG.toFixed(2)),
          chargeable_weight_kg: parseFloat(chargeableWeightKG.toFixed(2)),
          total_volume_cbm: parseFloat((volumeCBM * pieces).toFixed(3)),
          total_chargeable_weight_kg: parseFloat((chargeableWeightKG * pieces).toFixed(2))
        };
      });

      // Fetch the selected rate
      const { data: rate, error: rateError } = await supabase
        .from('lcl_ocean_freight_rate')
        .select(`
          *,
          vendor:vendor_id (id, name, logo_url, vendor_type)
        `)
        .eq('id', rate_id)
        .eq('tenant_id', tenantId)
        .single();

      if (rateError || !rate) {
        return reply.code(404).send({
          success: false,
          error: 'Rate not found'
        });
      }

      // Calculate freight cost
      let freightBuyAmount = 0;
      if (rate.rate_basis === 'PER_CBM') {
        freightBuyAmount = totalVolumeCBM * rate.rate_per_cbm;
      } else if (rate.rate_basis === 'PER_TON') {
        freightBuyAmount = (totalChargeableWeightKG / 1000) * rate.rate_per_ton;
      } else if (rate.rate_basis === 'PER_KG') {
        freightBuyAmount = totalChargeableWeightKG * rate.rate_per_kg;
      }

      // Apply minimum charge
      const minimumCharge = rate.minimum_charge || 0;
      const minimumChargeApplied = freightBuyAmount < minimumCharge;
      if (minimumChargeApplied) {
        freightBuyAmount = minimumCharge;
      }

      // Fetch surcharges
      const { data: surcharges } = await supabase
        .from('lcl_surcharge')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('vendor_id', rate.vendor_id)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString().split('T')[0])
        .gte('valid_to', new Date().toISOString().split('T')[0]);

      // Calculate surcharges grouped by applies_scope
      const surchargesByScope: any = {
        origin: [],
        port: [],
        freight: [],
        dest: [],
        door: [],
        other: []
      };

      let totalSurchargesBuy = 0;

      for (const surcharge of surcharges || []) {
        let amount = 0;

        switch (surcharge.rate_basis) {
          case 'PER_CBM':
            amount = totalVolumeCBM * surcharge.amount;
            break;
          case 'PER_TON':
            amount = (totalChargeableWeightKG / 1000) * surcharge.amount;
            break;
          case 'PER_KG':
            amount = totalChargeableWeightKG * surcharge.amount;
            break;
          case 'PER_SHIPMENT':
          case 'FLAT':
            amount = surcharge.amount;
            break;
          case 'PERCENTAGE':
            amount = freightBuyAmount * (surcharge.percentage / 100);
            break;
        }

        if (surcharge.min_charge && amount < surcharge.min_charge) {
          amount = surcharge.min_charge;
        }
        if (surcharge.max_charge && amount > surcharge.max_charge) {
          amount = surcharge.max_charge;
        }

        totalSurchargesBuy += amount;

        const scope = surcharge.applies_scope || 'other';
        surchargesByScope[scope].push({
          charge_code: surcharge.charge_code,
          charge_name: surcharge.charge_name || surcharge.charge_code,
          rate_basis: surcharge.rate_basis,
          buy_amount: parseFloat(amount.toFixed(2)),
          currency: surcharge.currency
        });
      }

      // Add any additional custom surcharges
      if (additional_surcharges && Array.isArray(additional_surcharges)) {
        for (const customSurcharge of additional_surcharges) {
          const scope = customSurcharge.applies_scope || 'other';
          surchargesByScope[scope].push({
            charge_code: customSurcharge.charge_code,
            charge_name: customSurcharge.charge_name || customSurcharge.charge_code,
            buy_amount: parseFloat(customSurcharge.amount.toFixed(2)),
            currency: customSurcharge.currency || rate.currency,
            note: 'Custom charge'
          });
          totalSurchargesBuy += customSurcharge.amount;
        }
      }

      // Calculate totals by scope
      const originTotal = surchargesByScope.origin.reduce((sum: number, s: any) => sum + s.buy_amount, 0);
      const portTotal = surchargesByScope.port.reduce((sum: number, s: any) => sum + s.buy_amount, 0);
      const freightSurchargesTotal = surchargesByScope.freight.reduce((sum: number, s: any) => sum + s.buy_amount, 0);
      const destTotal = surchargesByScope.dest.reduce((sum: number, s: any) => sum + s.buy_amount, 0);
      const doorTotal = surchargesByScope.door.reduce((sum: number, s: any) => sum + s.buy_amount, 0);
      const otherTotal = surchargesByScope.other.reduce((sum: number, s: any) => sum + s.buy_amount, 0);

      // Total buy amount
      const totalBuyAmount = freightBuyAmount + totalSurchargesBuy;

      // Margin is already applied in search-rates
      // If margin_rule_id is provided, we can fetch it for reference, but the calculation was done in search
      let marginDetails: any = null;
      let marginAmount = 0;

      if (margin_rule_id) {
        const { data: marginRule } = await supabase
          .from('margin_rule_v2')
          .select('*')
          .eq('id', margin_rule_id)
          .eq('tenant_id', tenantId)
          .single();

        if (marginRule) {
          if (marginRule.percentage) {
            marginAmount = totalBuyAmount * (marginRule.percentage / 100);
          } else if (marginRule.fixed_amount) {
            marginAmount = marginRule.fixed_amount;
          }

          marginDetails = {
            rule_id: marginRule.id,
            rule_name: marginRule.name || `Rule ${marginRule.id}`,
            scope: marginRule.scope,
            percentage: marginRule.percentage,
            fixed_amount: marginRule.fixed_amount,
            margin_amount: parseFloat(marginAmount.toFixed(2))
          };
        }
      }

      const totalSellAmount = totalBuyAmount + marginAmount;

      // Store shipment items
      const itemsToInsert = itemDetails.map((item: any) => ({
        enquiry_id,
        length_cm: item.length_cm,
        width_cm: item.width_cm,
        height_cm: item.height_cm,
        gross_weight_kg: item.gross_weight_kg,
        pieces: item.pieces || 1,
        commodity: item.commodity,
        packaging_type: item.packaging_type,
        is_hazardous: item.is_hazardous || false,
        is_temperature_controlled: item.is_temperature_controlled || false,
        tenant_id: tenantId
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('lcl_shipment_item')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.warn('Failed to store shipment items:', itemsError);
      }

      // Build response
      const quote = {
        quote_id: `LCL-${enquiry_id}-${Date.now()}`,
        enquiry_id,
        customer_id,
        created_at: new Date().toISOString(),
        salesforce_org_id,

        shipment_summary: {
          items: itemDetails,
          total_pieces: items.reduce((sum: number, item: any) => sum + (item.pieces || 1), 0),
          total_volume_cbm: parseFloat(totalVolumeCBM.toFixed(3)),
          total_weight_kg: parseFloat(totalWeightKG.toFixed(2)),
          total_chargeable_weight_kg: parseFloat(totalChargeableWeightKG.toFixed(2))
        },

        rate_details: {
          rate_id: rate.id,
          vendor_name: rate.vendor?.name,
          vendor_logo: rate.vendor?.logo_url,
          service_type: rate.service_type,
          pricing_model: rate.pricing_model,
          origin: rate.origin_code,
          destination: rate.destination_code,
          transit_days: rate.tt_days,
          frequency: rate.frequency
        },

        cost_breakdown: {
          freight: {
            buy_amount: parseFloat(freightBuyAmount.toFixed(2)),
            rate_basis: rate.rate_basis,
            rate_applied: rate.rate_per_cbm || rate.rate_per_ton || rate.rate_per_kg,
            calculation: rate.rate_basis === 'PER_CBM'
              ? `${totalVolumeCBM.toFixed(3)} CBM × ${rate.rate_per_cbm} ${rate.currency}/CBM`
              : rate.rate_basis === 'PER_TON'
              ? `${(totalChargeableWeightKG / 1000).toFixed(2)} TON × ${rate.rate_per_ton} ${rate.currency}/TON`
              : `${totalChargeableWeightKG.toFixed(2)} KG × ${rate.rate_per_kg} ${rate.currency}/KG`,
            minimum_charge: minimumCharge,
            minimum_charge_applied: minimumChargeApplied
          },

          surcharges: {
            origin: {
              charges: surchargesByScope.origin,
              total: parseFloat(originTotal.toFixed(2))
            },
            port: {
              charges: surchargesByScope.port,
              total: parseFloat(portTotal.toFixed(2))
            },
            freight_surcharges: {
              charges: surchargesByScope.freight,
              total: parseFloat(freightSurchargesTotal.toFixed(2))
            },
            destination: {
              charges: surchargesByScope.dest,
              total: parseFloat(destTotal.toFixed(2))
            },
            door: {
              charges: surchargesByScope.door,
              total: parseFloat(doorTotal.toFixed(2))
            },
            other: {
              charges: surchargesByScope.other,
              total: parseFloat(otherTotal.toFixed(2))
            }
          },

          total_buy: parseFloat(totalBuyAmount.toFixed(2))
        },

        margin: marginDetails,

        sell_price: {
          total: parseFloat(totalSellAmount.toFixed(2)),
          currency: rate.currency,
          valid_until: rate.valid_to
        },

        notes
      };

      console.log('✅ [LCL QUOTE] Quote generated:', quote.quote_id);

      return reply.send({
        success: true,
        data: quote
      });
    } catch (error: any) {
      console.error('❌ [LCL QUOTE] Error:', error);
      return reply.code(500).send({
        success: false,
        error: error.message || 'Failed to prepare LCL quote'
      });
    }
  });
}

