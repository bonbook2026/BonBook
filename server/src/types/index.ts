export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'DELIVERY_PENDING'
  | 'DELIVERED'
  | 'DELIVERY_FAILED';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'VERIFIED' | 'FAILED';

export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

export interface CreateOrderRequest {
  books: { title: string }[];
}

export interface ExchangeRateResult {
  rate: number;
  source: string;
  timestamp: Date;
}

export interface PaymentInitResult {
  paymentId: string;
  paymentUrl: string;
}

export interface PaymentVerifyResult {
  verified: boolean;
  paymentId: string;
  amount: number;
  refId?: string;
  rawData?: Record<string, unknown>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ExchangeRateProvider {
  getUsdToIrrRate(): Promise<ExchangeRateResult>;
}

export interface PaymentProvider {
  initPayment(orderId: number, amountIrr: number, description: string): Promise<PaymentInitResult>;
  verifyPayment(paymentId: string, orderId: number): Promise<PaymentVerifyResult>;
}

export interface EmailProvider {
  sendBookEmail(
    to: string,
    bookTitles: string[],
    bookFiles: { title: string; url: string }[]
  ): Promise<EmailSendResult>;
}
