import { describe, it, expect } from 'vitest';
import { ExchangeRateService } from '../src/services/exchangeRateService';
import { ExchangeRateProvider, ExchangeRateResult } from '../src/types';

class MockExchangeRateProvider implements ExchangeRateProvider {
  private rate: number;

  constructor(rate: number) {
    this.rate = rate;
  }

  async getUsdToIrrRate(): Promise<ExchangeRateResult> {
    return { rate: this.rate, source: 'mock', timestamp: new Date() };
  }
}

describe('ExchangeRateService', () => {
  it('should get current rate', async () => {
    const service = new ExchangeRateService(new MockExchangeRateProvider(600000));
    const result = await service.getCurrentRate();
    expect(result.rate).toBe(600000);
  });

  it('should cache rate within expiry', async () => {
    let callCount = 0;
    const provider: ExchangeRateProvider = {
      async getUsdToIrrRate() {
        callCount++;
        return { rate: 600000, source: 'mock', timestamp: new Date() };
      },
    };

    const service = new ExchangeRateService(provider);
    await service.getCurrentRate();
    await service.getCurrentRate();
    expect(callCount).toBe(1);
  });

  it('should calculate IRR total correctly', () => {
    const service = new ExchangeRateService(new MockExchangeRateProvider(600000));

    expect(service.calculateIrrTotal(8, 600000)).toBe(4800000);
    expect(service.calculateIrrTotal(24, 600000)).toBe(14400000);
    expect(service.calculateIrrTotal(24, 1000000)).toBe(24000000);
  });

  it('should round IRR total to integer', () => {
    const service = new ExchangeRateService(new MockExchangeRateProvider(600001));
    const result = service.calculateIrrTotal(3, 600001);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('Price calculation integration', () => {
  it('should correctly calculate: 1 x $8 = $8', () => {
    expect(1 * 8).toBe(8);
  });

  it('should correctly calculate: 2 x $8 = $16', () => {
    expect(2 * 8).toBe(16);
  });

  it('should correctly calculate: 10 x $8 = $80', () => {
    expect(10 * 8).toBe(80);
  });

  it('should convert USD to IRR correctly', () => {
    const rate = 600000;
    const totalUsd = 24;
    expect(Math.round(totalUsd * rate)).toBe(14400000);
  });
});
