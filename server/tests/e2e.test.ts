import { describe, it, expect } from 'vitest';
import { TelegramAuthService } from '../src/services/telegramAuthService';
import { UserService } from '../src/services/userService';
import { BookService } from '../src/services/bookService';
import { PaymentProvider, PaymentInitResult, PaymentVerifyResult, EmailProvider, EmailSendResult } from '../src/types';
import { createTelegramInitData, TEST_BOT_TOKEN } from './helpers';

class MockPaymentProvider implements PaymentProvider {
  async initPayment(orderId: number, amountIrr: number, _description: string): Promise<PaymentInitResult> {
    return { paymentId: `pay_${orderId}`, paymentUrl: `https://pay.test/${orderId}?amount=${amountIrr}` };
  }
  async verifyPayment(paymentId: string, _orderId: number): Promise<PaymentVerifyResult> {
    return { verified: true, paymentId, amount: 45000000, refId: 'ref_123' };
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

    // Fixed Toman prices; the provider receives IRR without a currency-rate lookup.
    const { totalToman, totalIrr, unitPrice } = bookService.calculateTotal(books.length);
    expect(totalToman).toBe(4500000);
    expect(unitPrice).toBe(1500000);
    expect(totalIrr).toBe(45000000);

    // Step 6: Initiate Payment
    const paymentProvider = new MockPaymentProvider();
    const paymentResult = await paymentProvider.initPayment(1, totalIrr, 'Test');
    expect(paymentResult.paymentId).toBeTruthy();
    expect(paymentResult.paymentUrl).toBeTruthy();

    // Step 7: Verify Payment
    const verifyResult = await paymentProvider.verifyPayment(paymentResult.paymentId, 1);
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.amount).toBe(totalIrr);

    // Step 8: Send Books via Email
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

  it('should snapshot fixed prices for an order', () => {
    const orderData = new BookService().calculateTotal(3);
    expect(orderData.totalToman).toBe(4500000);
    expect(orderData.totalIrr).toBe(45000000);
  });
});
