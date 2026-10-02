import { ExchangeRateProvider, ExchangeRateResult } from '../../types';

// TODO: Replace with real Navasan API credentials and verify endpoint
// Navasan API: https://platform.navasan.tech
// Requires API key from environment variable EXCHANGE_RATE_API_KEY
export class NavasanProvider implements ExchangeRateProvider {
  private apiKey: string;
  private baseUrl = 'https://api.navasan.tech/latest/';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getUsdToIrrRate(): Promise<ExchangeRateResult> {
    if (!this.apiKey) {
      throw new Error('Exchange rate API key is not configured. Set EXCHANGE_RATE_API_KEY in environment.');
    }

    const url = `${this.baseUrl}?api_key=${this.apiKey}&item=usd_sell`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Exchange rate API returned status ${response.status}`);
    }

    const data = await response.json() as Record<string, { value: string }>;

    if (!data?.usd_sell?.value) {
      throw new Error('Invalid response from exchange rate API');
    }

    const rate = parseFloat(data.usd_sell.value);

    if (isNaN(rate) || rate <= 0) {
      throw new Error('Invalid exchange rate value received');
    }

    return {
      rate,
      source: 'navasan',
      timestamp: new Date(),
    };
  }
}
