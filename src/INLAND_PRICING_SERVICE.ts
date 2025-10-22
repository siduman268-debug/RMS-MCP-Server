// ============================================================================
// ENHANCED INLAND PRICING SERVICE
// ============================================================================
// Combines the best of both approaches: simple database functions + professional structure

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

interface InlandPricingParams {
  pol_code: string;
  pod_code: string;
  container_type: string;
  container_count: number;
  cargo_weight_mt?: number;      // Optional for backward compatibility
  incoterm?: string;              // Optional, defaults to 'CIF'
  haulage_type?: 'merchant' | 'carrier';  // Optional, defaults to 'carrier'
}

interface InlandPricingResponse {
  success: boolean;
  route: any;  // Simplified to match actual result structure
  pricing: any;  // Simplified to match actual result structure
}

interface LocationInfo {
  id: number;
  unlocode: string;
  location_name: string;
  is_container_inland: boolean;
  parent_location_id?: number;
}

interface FreightPricing {
  vendor: string;
  rate_id: number;
  buy_amount: number;
  sell_amount: number;
  total: number;
  transit_days: number;
}

interface ChargeSummary {
  charges: any[];
  total: number;
  count: number;
}

interface HaulageCharges {
  route_id: number;
  route_name: string;
  from_location: string;
  to_location: string;
  rate_per_container: number;
  total_amount: number;
  included_in_quote: boolean;
  arranged_by: string;
  paid_by: string;
  weight_slab?: WeightSlabInfo;
}

interface WeightSlabInfo {
  container_type: string;
  cargo_weight_mt: number;
  min_weight_kg: number;
  max_weight_kg: number;
  rate_applied: number;
}

interface HaulageResponsibility {
  ihe_arranged_by: string;
  ihe_paid_by: string;
  ihe_include_in_quote: boolean;
  ihi_arranged_by: string;
  ihi_paid_by: string;
  ihi_include_in_quote: boolean;
}

interface MarginBreakdown {
  type: string;
  percentage: number;
  amount: number;
}

// ============================================================================
// 2. ENHANCED INLAND PRICING SERVICE
// ============================================================================

export class InlandPricingService {
  constructor(private supabase: SupabaseClient) {}

  async priceInlandEnquiry(params: InlandPricingParams): Promise<InlandPricingResponse> {
    try {
      // Set defaults
      const cargoWeightMt = params.cargo_weight_mt || 20; // Default weight
      const incoterm = params.incoterm || 'CIF';
      const haulageType = params.haulage_type || 'carrier';

      // Use the simplified inland function with working IHE logic
      const { data: result, error: resultError } = await this.supabase
        .rpc('simplified_inland_function', {
          p_pol_code: params.pol_code,
          p_pod_code: params.pod_code,
          p_container_type: params.container_type,
          p_container_count: params.container_count,
          p_cargo_weight_mt: cargoWeightMt,
          p_incoterm: incoterm,
          p_haulage_type: haulageType
        });

      if (resultError) throw new Error(`Production inland pricing failed: ${resultError.message}`);
      if (!result || !(result as any)?.success) throw new Error((result as any)?.error_message || 'Inland pricing failed');

      // Type the result properly
      const typedResult = result as any;

      // Return the result directly from the database function
      return {
        success: true,
        route: typedResult.route,
        pricing: typedResult.pricing
      };

    } catch (error) {
      console.error('Inland pricing error:', error);
      throw new Error(`Inland pricing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // -------------------------------------------------------------------------
  // HELPER METHODS
  // -------------------------------------------------------------------------

  private async getHaulageResponsibility(incoterm: string): Promise<HaulageResponsibility> {
    const { data, error } = await this.supabase
      .from('haulage_responsibility')
      .select('*')
      .eq('incoterm', incoterm)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // Fallback defaults
      return {
        ihe_arranged_by: 'carrier',
        ihe_paid_by: 'carrier',
        ihe_include_in_quote: true,
        ihi_arranged_by: 'carrier',
        ihi_paid_by: 'carrier',
        ihi_include_in_quote: true
      };
    }

    return {
      ihe_arranged_by: data.pol_haulage_responsibility,
      ihe_paid_by: data.pol_haulage_responsibility,
      ihe_include_in_quote: data.pol_haulage_responsibility === 'carrier',
      ihi_arranged_by: data.pod_haulage_responsibility,
      ihi_paid_by: data.pod_haulage_responsibility,
      ihi_include_in_quote: data.pod_haulage_responsibility === 'carrier'
    };
  }

  private async getLocalCharges(
    polCode: string,
    podCode: string,
    containerType: string,
    inlandQuoteData: any
  ) {
    // Use existing v_local_charges_details logic
    const { data: originChargesRaw } = await this.supabase
      .from('v_local_charges_details')
      .select('*')
      .eq('charge_location_type', 'Origin Charges')
      .or(`surcharge_container_type.eq.${containerType},surcharge_container_type.is.null`);

    const { data: destChargesRaw } = await this.supabase
      .from('v_local_charges_details')
      .select('*')
      .eq('charge_location_type', 'Destination Charges')
      .or(`surcharge_container_type.eq.${containerType},surcharge_container_type.is.null`);

    const originTotal = originChargesRaw?.reduce((sum: number, c: any) => 
      sum + (c.charge_amount || 0), 0) || 0;
    const destTotal = destChargesRaw?.reduce((sum: number, c: any) => 
      sum + (c.charge_amount || 0), 0) || 0;

    return {
      originCharges: {
        charges: originChargesRaw || [],
        total: originTotal,
        count: originChargesRaw?.length || 0
      },
      destCharges: {
        charges: destChargesRaw || [],
        total: destTotal,
        count: destChargesRaw?.length || 0
      }
    };
  }

  private async calculateHaulageCharges(
    inlandQuoteData: any,
    params: InlandPricingParams,
    haulageResp: HaulageResponsibility,
    haulageType: string
  ) {
    let iheCharges = null;
    let ihiCharges = null;

    // IHE charges
    if (inlandQuoteData.pol_is_inland && inlandQuoteData.ihe_rate_amount > 0) {
      if (haulageType === 'carrier' && haulageResp.ihe_include_in_quote) {
        iheCharges = {
          route_id: 0,
          route_name: `${inlandQuoteData.pol_code} → ${inlandQuoteData.pol_gateway_code}`,
          from_location: inlandQuoteData.pol_code,
          to_location: inlandQuoteData.pol_gateway_code,
          rate_per_container: inlandQuoteData.ihe_rate_amount,
          total_amount: inlandQuoteData.ihe_rate_amount,
          included_in_quote: true,
          arranged_by: haulageResp.ihe_arranged_by,
          paid_by: haulageResp.ihe_paid_by
        };
      }
    }

    // IHI charges
    if (inlandQuoteData.pod_is_inland && inlandQuoteData.ihi_rate_amount > 0) {
      if (haulageType === 'carrier' && haulageResp.ihi_include_in_quote) {
        ihiCharges = {
          route_id: 0,
          route_name: `${inlandQuoteData.pod_gateway_code} → ${inlandQuoteData.pod_code}`,
          from_location: inlandQuoteData.pod_gateway_code,
          to_location: inlandQuoteData.pod_code,
          rate_per_container: inlandQuoteData.ihi_rate_amount,
          total_amount: inlandQuoteData.ihi_rate_amount,
          included_in_quote: true,
          arranged_by: haulageResp.ihi_arranged_by,
          paid_by: haulageResp.ihi_paid_by
        };
      }
    }

    return { iheCharges, ihiCharges };
  }

  private async calculateMargin(totalBuy: number): Promise<MarginBreakdown> {
    // Use existing margin calculation logic
    const percentage = 10; // 10% margin
    const amount = totalBuy * (percentage / 100);
    
    return {
      type: 'percentage',
      percentage,
      amount
    };
  }
}

// ============================================================================
// 3. MCP TOOL DEFINITION
// ============================================================================

export const inlandPricingTool = {
  name: 'price_inland_enquiry',
  description: `Price an inland enquiry with IHE/IHI calculations. Automatically determines if direct ocean freight is available from inland location, or routes via gateway port.`,
  
  parameters: {
    type: 'object',
    properties: {
      pol_code: {
        type: 'string',
        description: 'Port/ICD of Loading UN/LOCODE (e.g., INNSA, INTKD)'
      },
      pod_code: {
        type: 'string',
        description: 'Port/ICD of Discharge UN/LOCODE (e.g., NLRTM, DEHAM)'
      },
      container_type: {
        type: 'string',
        description: 'Container type (20GP, 40GP, 40HC)'
      },
      container_count: {
        type: 'number',
        description: 'Number of containers',
        default: 1
      },
      cargo_weight_mt: {
        type: 'number',
        description: 'Cargo weight in metric tons (optional, defaults to 20MT)'
      },
      incoterm: {
        type: 'string',
        description: 'Incoterm (FOB, CIF, EXW, etc.)',
        enum: ['FOB', 'CIF', 'EXW', 'FCA', 'CPT', 'DAP', 'DDP']
      },
      haulage_type: {
        type: 'string',
        description: 'Merchant (shipper arranges) or Carrier (shipping line arranges)',
        enum: ['merchant', 'carrier']
      }
    },
    required: ['pol_code', 'pod_code', 'container_type']
  }
};

// ============================================================================
// 4. MCP HANDLER
// ============================================================================

export async function handleInlandPricingMCP(params: InlandPricingParams, supabase: SupabaseClient) {
  const service = new InlandPricingService(supabase);
  return await service.priceInlandEnquiry(params);
}
