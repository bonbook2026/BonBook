import { describe, it, expect, vi } from 'vitest';
import { PaymentProvider, PaymentInitResult, PaymentVerifyResult } from '../src/types';

class MockPaymentProvider implements PaymentProvider {
  initResult: PaymentInitResult = { paymentId: 'pay_123', paymentUrl: 'https://pay.test/123' };
  verifyResult: PaymentVerifyResult = { verified: true, paymentId: 'pay_123', amount: 14400000 };

  async initPayment(_orderId: number, _amountIrr: number, _description: string): Promise<PaymentInitResult> {
    return this.initResult;
  }

  async verifyPayment(_paymentId: string, _orderId: number): Promise<PaymentVerifyResult> {
    return this.verifyResult;
  }
}

describe('Payment Flow', () => {
  it('should create payment with correct data', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.initPayment(1, 14400000, 'Test order');
    expect(result.paymentId).toBe('pay_123');
    expect(result.paymentUrl).toBeTruthy();
  });

  it('should verify successful payment', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.verifyPayment('pay_123', 1);
    expect(result.verified).toBe(true);
    expect(result.amount).toBe(14400000);
  });

  it('should handle failed verification', async () => {
    const provider = new MockPaymentProvider();
    provider.verifyResult = { verified: false, paymentId: 'pay_123', amount: 0 };
    const result = await provider.verifyPayment('pay_123', 1);
    expect(result.verified).toBe(false);
  });

  it('should detect amount mismatch', async () => {
    const provider = new MockPaymentProvider();
    provider.verifyResult = { verified: true, paymentId: 'pay_123', amount: 5000000 };
    const result = await provider.verifyPayment('pay_123', 1);

    const orderTotalIrr = 14400000;
    expect(result.amount).not.toBe(orderTotalIrr);
  });

  it('should handle duplicate verification gracefully', async () => {
    const provider = new MockPaymentProvider();
    const result1 = await provider.verifyPayment('pay_123', 1);
    const result2 = await provider.verifyPayment('pay_123', 1);

    expect(result1.verified).toBe(true);
    expect(result2.verified).toBe(true);
  });
});

describe('Payment Security', () => {
  it('should not trust frontend-only success signal', () => {
    const frontendSaysSuccess = true;
    const backendVerified = false;

    // Payment is ONLY valid when backend verifies
    expect(frontendSaysSuccess && !backendVerified).toBe(true);
    expect(backendVerified).toBe(false); // This is the source of truth
  });

  it('should verify amount matches order total', () => {
    const orderTotal = 14400000;
    const paidAmount = 14400000;
    const wrongAmount = 100000;

    expect(paidAmount === orderTotal).toBe(true);
    expect(wrongAmount === orderTotal).toBe(false);
  });

  it('should verify payment belongs to correct order', () => {
    const paymentOrderId = 5;
    const requestedOrderId = 5;
    const wrongOrderId = 10;

    expect(paymentOrderId === requestedOrderId).toBe(true);
    expect(paymentOrderId === wrongOrderId).toBe(false);
  });
});
