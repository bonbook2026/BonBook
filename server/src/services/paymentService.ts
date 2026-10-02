import prisma from '../lib/prisma';
import { PaymentProvider } from '../types';

export class PaymentService {
  private provider: PaymentProvider;

  constructor(provider: PaymentProvider) {
    this.provider = provider;
  }

  async initiatePayment(orderId: number, amountIrr: number, description: string) {
    const existing = await prisma.payment.findFirst({
      where: { orderId, status: { in: ['PENDING', 'PROCESSING'] } },
    });

    if (existing) {
      throw new Error('یک پرداخت فعال برای این سفارش وجود دارد');
    }

    const result = await this.provider.initPayment(orderId, amountIrr, description);

    const payment = await prisma.payment.create({
      data: {
        orderId,
        provider: 'boncard',
        paymentId: result.paymentId,
        amountIrr,
        status: 'PROCESSING',
      },
    });

    return { payment, paymentUrl: result.paymentUrl };
  }

  async verifyPayment(paymentId: string, orderId: number) {
    const payment = await prisma.payment.findFirst({
      where: { paymentId, orderId },
    });

    if (!payment) {
      throw new Error('پرداخت یافت نشد');
    }

    // Idempotency: if already verified, return existing result
    if (payment.status === 'VERIFIED') {
      return { alreadyVerified: true, payment };
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new Error('سفارش یافت نشد');
    }

    const result = await this.provider.verifyPayment(paymentId, orderId);

    if (!result.verified) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', rawData: JSON.stringify(result.rawData) },
      });
      return { alreadyVerified: false, verified: false, payment };
    }

    // Amount verification: ensure paid amount matches order total
    if (result.amount !== order.totalIrr) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', rawData: JSON.stringify({ ...result.rawData, mismatch: true }) },
      });
      throw new Error('مبلغ پرداخت شده با مبلغ سفارش مطابقت ندارد');
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        rawData: JSON.stringify(result.rawData),
      },
    });

    return { alreadyVerified: false, verified: true, payment, refId: result.refId };
  }
}
