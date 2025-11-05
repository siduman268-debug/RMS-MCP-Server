import type { CarrierDCSAAdapter, DCSAScheduleMessage } from '../../types/dcsa.types.js';

/**
 * Base adapter for DCSA-compliant carrier APIs
 */
export abstract class BaseDCSAAdapter implements CarrierDCSAAdapter {
  protected apiKey: string;
  protected apiBaseUrl: string;

  constructor(apiKey: string, apiBaseUrl: string) {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
  }

  abstract fetchSchedules(params: {
    carrierServiceCode?: string;
    voyageNumber?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<DCSAScheduleMessage[]>;

  abstract transformToDCSA(data: unknown): DCSAScheduleMessage;

  /**
   * Make authenticated API request
   */
  protected async makeRequest<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    const url = new URL(endpoint, this.apiBaseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `DCSA API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }
}

