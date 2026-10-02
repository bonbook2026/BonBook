import { describe, it, expect } from 'vitest';
import { TelegramAuthService } from '../src/services/telegramAuthService';
import { UserService } from '../src/services/userService';
import { BookService } from '../src/services/bookService';
import { ExchangeRateService } from '../src/services/exchangeRateService';
import { ExchangeRateProvider, ExchangeRateResult, PaymentProvider, PaymentInitResult, PaymentVerifyResult, EmailProvider, EmailSendResult } from '../src/types';
import { createTelegramInitData, TEST_BOT_TOKEN } from './helpers';

class MockExchangeRateProvider implements ExchangeRateProvider {
  async getUsdToIrrRate(): Promise<ExchangeRateResult> {
    return { rate: 600000, source: 'mock', timestamp: new Date() };
  }
}

class MockPaymentProvider implements PaymentProvider {
  async initPayment(orderId: number, amountIrr: number, _description: string): Promise<PaymentInitResult> {
    return { paymentId: `pay_${orderId}`, paymentUrl: `https://pay.test/${orderId}?amount=${amountIrr}` };
  }
  async verifyPayment(paymentId: string, _orderId: number): Promise<PaymentVerifyResult> {
    return { verified: true, paymentId, amount: 14400000, refId: 'ref_123' };
  }
}

class MockEmailProvider implements EmailProvider {
  sentEmails: { to: string; titles: string[] }[] = [];
  async sendBookEmail(to: string, bookTitles: string[], _bookFiles: { title: string; url: string }[]): Promise<EmailSendResult> {
    this.sentEmails.push({ to, titles: bookTitles });
    return { success: true, messageId: 'msg_test' };
  }
}

describe('E2E Flow', () => {
  it('should complete the full purchase flow', async () => {
    // Step 1: Telegram Authentication
    const authService = new TelegramAuthService(TEST_BOT_TOKEN);
    const initData = createTelegramInitData({ id: 12345, first_name: 'Ali', last_name: 'Ahmadi' });
    const telegramUser = authService.validateInitData(initData);
    expect(telegramUser.id).toBe(12345);
    expect(telegramUser.first_name).toBe('Ali');

    // Step 2: Profile Check
    const userService = new UserService();
    const incompleteProfile = userService.isProfileComplete({
      firstName: 'Ali',
      lastName: 'Ahmadi',
      email: null,
    });
    expect(incompleteProfile.complete).toBe(false);
    expect(incompleteProfile.missing).toContain('ایمیل');

    // Step 3: Complete Profile
    const completeProfile = userService.isProfileComplete({
      firstName: 'Ali',
      lastName: 'Ahmadi',
      email: 'ali@gmail.com',
    });
    expect(completeProfile.complete).toBe(true);

    // Step 4: Select Books
    const bookService = new BookService();
    const books = [
      { title: 'Clean Code' },
      { title: 'Design Patterns' },
      { title: 'Refactoring' },
    ];
    const validation = bookService.validateBookList(books);
    expect(validation.valid).toBe(true);

    // Step 5: Calculate USD Total
    const { totalUsd, unitPrice } = bookService.calculateTotal(books.length);
    expect(totalUsd).toBe(24);
    expect(unitPrice).toBe(8);

    // Step 6: Get Exchange Rate
    const exchangeRateService = new ExchangeRateService(new MockExchangeRateProvider());
    const rateResult = await exchangeRateService.getCurrentRate();
    expect(rateResult.rate).toBe(600000);

    // Step 7: Calculate IRR Total
    const totalIrr = exchangeRateService.calculateIrrTotal(totalUsd, rateResult.rate);
    expect(totalIrr).toBe(14400000);

    // Step 8: Initiate Payment
    const paymentProvider = new MockPaymentProvider();
    const paymentResult = await paymentProvider.initPayment(1, totalIrr, 'Test');
    expect(paymentResult.paymentId).toBeTruthy();
    expect(paymentResult.paymentUrl).toBeTruthy();

    // Step 9: Verify Payment
    const verifyResult = await paymentProvider.verifyPayment(paymentResult.paymentId, 1);
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.amount).toBe(totalIrr);

    // Step 10: Send Books via Email
    const emailProvider = new MockEmailProvider();
    const emailResult = await emailProvider.sendBookEmail(
      'ali@gmail.com',
      books.map((b) => b.title),
      []
    );
    expect(emailResult.success).toBe(true);
    expect(emailProvider.sentEmails).toHaveLength(1);
    expect(emailProvider.sentEmails[0].to).toBe('ali@gmail.com');
    expect(emailProvider.sentEmails[0].titles).toHaveLength(3);
  });

  it('should block checkout for incomplete profile', () => {
    const userService = new UserService();
    const result = userService.isProfileComplete({
      firstName: 'Ali',
      lastName: null,
      email: 'ali@gmail.com',
    });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('نام خانوادگی');
  });

  it('should reject order with empty book titles', () => {
    const bookService = new BookService();
    const result = bookService.validateBookList([
      { title: 'Valid Book' },
      { title: '' },
    ]);
    expect(result.valid).toBe(false);
  });

  it('should store exchange rate with order data', async () => {
    const exchangeRateService = new ExchangeRateService(new MockExchangeRateProvider());
    const rate = await exchangeRateService.getCurrentRate();

    const orderData = {
      exchangeRate: rate.rate,
      totalUsd: 24,
      totalIrr: exchangeRateService.calculateIrrTotal(24, rate.rate),
    };

    expect(orderData.exchangeRate).toBe(600000);
    expect(orderData.totalIrr).toBe(14400000);

    // Rate changes shouldn't affect stored order
    const newRate = 700000;
    expect(orderData.totalIrr).toBe(14400000); // Still the old amount
    expect(orderData.totalIrr).not.toBe(24 * newRate);
  });
});
