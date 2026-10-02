import prisma from '../lib/prisma';
import { EmailProvider } from '../types';

export class DeliveryService {
  private emailProvider: EmailProvider;

  constructor(emailProvider: EmailProvider) {
    this.emailProvider = emailProvider;
  }

  async deliverBooks(orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: true },
    });

    if (!order) throw new Error('سفارش یافت نشد');
    if (!order.user.email) throw new Error('ایمیل کاربر ثبت نشده');

    // Check for existing successful delivery (idempotency)
    const existingDelivery = await prisma.delivery.findFirst({
      where: { orderId, status: 'DELIVERED' },
    });
    if (existingDelivery) {
      return existingDelivery;
    }

    const delivery = await prisma.delivery.create({
      data: {
        orderId,
        email: order.user.email,
        status: 'PENDING',
      },
    });

    try {
      const bookTitles = order.items.map((item) => item.bookTitle);
      // TODO: Get real book file URLs from Book records when available
      const bookFiles = order.items.map((item) => ({
        title: item.bookTitle,
        url: '', // Will be populated from Book.fileUrl when files are uploaded
      }));

      await this.emailProvider.sendBookEmail(order.user.email, bookTitles, bookFiles);

      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { status: 'DELIVERED', sentAt: new Date() },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED' },
      });

      return delivery;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { status: 'FAILED', errorMessage },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERY_FAILED' },
      });

      throw error;
    }
  }
}
