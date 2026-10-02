import { ExchangeRateProvider } from '../../types';
import { NavasanProvider } from './navasan';
import { config } from '../../config';

export function createExchangeRateProvider(): ExchangeRateProvider {
  switch (config.exchangeRate.provider) {
    case 'navasan':
      return new NavasanProvider(config.exchangeRate.apiKey);
    default:
      throw new Error(`Unknown exchange rate provider: ${config.exchangeRate.provider}`);
  }
}
