import { PaymentProvider, PaymentInitResult, PaymentVerifyResult } from '../../types';

// TODO: Implement real BonCard API integration when API documentation and credentials are available.
// This provider implements the PaymentProvider interface with placeholder logic.
// Do NOT use in production until real BonCard API contract is verified.
export class BonCardProvider implements PaymentProvider {
  private apiUrl: string;
  private apiKey: string;
  private secretKey: string;
  private callbackUrl: string;

  constructor(apiUrl: string, apiKey: string, secretKey: string, callbackUrl: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.callbackUrl = callbackUrl;
  }

  async initPayment(orderId: number, amountIrr: number, description: string): Promise<PaymentInitResult> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error(
        'BonCard API credentials are not configured. Set BONCARD_API_URL, BONCARD_API_KEY, and BONCARD_SECRET_KEY in environment.'
      );
    }

    // TODO: Replace with real BonCard API call
    // Expected flow:
    // 1. POST to BonCard API with order details
    // 2. Receive payment ID and redirect URL
    // 3. Return both to caller
    //
    // Example expected request:
    // POST {apiUrl}/api/payment/init
    // Headers: { Authorization: Bearer {apiKey} }
    // Body: { order_id, amount, callback_url, description }
    //
    // Example expected response:
    // { payment_id: "...", payment_url: "https://boncard.ir/pay/..." }

    const response = await fetch(`${this.apiUrl}/api/payment/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        order_id: orderId,
        amount: amountIrr,
        callback_url: this.callbackUrl,
        description,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BonCard init payment failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { payment_id: string; payment_url: string };

    return {
      paymentId: data.payment_id,
      paymentUrl: data.payment_url,
    };
  }

  async verifyPayment(paymentId: string, orderId: number): Promise<PaymentVerifyResult> {
    if (!this.apiUrl || !this.apiKey || !this.secretKey) {
      throw new Error('BonCard API credentials are not configured.');
    }

    // TODO: Replace with real BonCard verification API call
    // Expected flow:
    // 1. POST to BonCard verify endpoint
    // 2. Include payment_id and secret for HMAC/signature
    // 3. BonCard confirms payment status and amount
    //
    // Example expected request:
    // POST {apiUrl}/api/payment/verify
    // Headers: { Authorization: Bearer {apiKey} }
    // Body: { payment_id, secret_key }
    //
    // Example expected response:
    // { verified: true, amount: 24000000, ref_id: "...", status: "success" }

    const response = await fetch(`${this.apiUrl}/api/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        payment_id: paymentId,
        secret_key: this.secretKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BonCard verify payment failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { verified?: boolean; status?: string; amount: number; ref_id?: string };

    return {
      verified: data.verified === true || data.status === 'success',
      paymentId,
      amount: data.amount,
      refId: data.ref_id,
      rawData: data as unknown as Record<string, unknown>,
    };
  }
}
