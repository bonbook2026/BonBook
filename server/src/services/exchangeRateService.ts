import { ExchangeRateProvider, ExchangeRateResult } from '../types';

export class ExchangeRateService {
  private provider: ExchangeRateProvider;
  private cachedRate: ExchangeRateResult | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(provider: ExchangeRateProvider) {
    this.provider = provider;
  }

  async getCurrentRate(): Promise<ExchangeRateResult> {
    if (this.cachedRate && Date.now() - this.cachedRate.timestamp.getTime() < this.cacheExpiry) {
      return this.cachedRate;
    }

    const result = await this.provider.getUsdToIrrRate();
    this.cachedRate = result;
    return result;
  }

  calculateIrrTotal(totalUsd: number, rate: number): number {
    return Math.round(totalUsd * rate);
  }
}
