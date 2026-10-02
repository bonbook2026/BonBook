import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OrderService } from '../services/orderService';
import { PaymentService } from '../services/paymentService';
import { DeliveryService } from '../services/deliveryService';
import { createPaymentProvider } from '../providers/payment';
import { createEmailProvider } from '../providers/email';

const orderService = new OrderService();
const paymentService = new PaymentService(createPaymentProvider());
const deliveryService = new DeliveryService(createEmailProvider());

export async function initiatePayment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.body;

    if (!orderId || typeof orderId !== 'number') {
      res.status(400).json({ error: 'شناسه سفارش ارسال نشده' });
      return;
    }

    const isOwner = await orderService.isOrderOwnedByUser(orderId, req.userId!);
    if (!isOwner) {
      res.status(403).json({ error: 'دسترسی به این سفارش مجاز نیست' });
      return;
    }

    const order = await orderService.getOrderById(orderId);
    if (!order) {
      res.status(404).json({ error: 'سفارش یافت نشد' });
      return;
    }

    if (order.status !== 'PENDING') {
      res.status(400).json({ error: 'این سفارش قابل پرداخت نیست' });
      return;
    }

    await orderService.updateStatus(orderId, 'PAYMENT_PROCESSING');

    const description = `BonBook - سفارش ${order.orderNumber} - ${order.totalBooks} کتاب`;
    const { payment, paymentUrl } = await paymentService.initiatePayment(
      orderId,
      order.totalIrr,
      description
    );

    res.json({
      paymentId: payment.paymentId,
      paymentUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountIrr: order.totalIrr,
    });
  } catch (error) {
    next(error);
  }
}

export async function paymentCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { payment_id, order_id, status } = req.query;

    if (!payment_id || !order_id) {
      res.status(400).json({ error: 'اطلاعات پرداخت ناقص است' });
      return;
    }

    const orderId = parseInt(order_id as string, 10);
    if (isNaN(orderId)) {
      res.status(400).json({ error: 'شناسه سفارش نامعتبر است' });
      return;
    }

    if (status === 'failed' || status === 'cancelled') {
      await orderService.updateStatus(orderId, 'PAYMENT_FAILED');
      const order = await orderService.getOrderById(orderId);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed?order=${order?.orderNumber}`);
      return;
    }

    // Server-side verification — never trust callback status alone
    const result = await paymentService.verifyPayment(payment_id as string, orderId);

    if (result.alreadyVerified) {
      const order = await orderService.getOrderById(orderId);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/success?order=${order?.orderNumber}`);
      return;
    }

    if (!result.verified) {
      await orderService.updateStatus(orderId, 'PAYMENT_FAILED');
      const order = await orderService.getOrderById(orderId);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-failed?order=${order?.orderNumber}`);
      return;
    }

    await orderService.updateStatus(orderId, 'PAID');

    // Attempt delivery — payment remains PAID even if delivery fails
    try {
      await deliveryService.deliverBooks(orderId);
    } catch (deliveryError) {
      console.error('Delivery failed after payment:', deliveryError);
    }

    const order = await orderService.getOrderById(orderId);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/success?order=${order?.orderNumber}`);
  } catch (error) {
    next(error);
  }
}

export async function verifyPaymentManual(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { paymentId, orderId } = req.body;

    if (!paymentId || !orderId) {
      res.status(400).json({ error: 'اطلاعات تأیید پرداخت ناقص است' });
      return;
    }

    const isOwner = await orderService.isOrderOwnedByUser(orderId, req.userId!);
    if (!isOwner) {
      res.status(403).json({ error: 'دسترسی مجاز نیست' });
      return;
    }

    const result = await paymentService.verifyPayment(paymentId, orderId);

    if (result.alreadyVerified) {
      res.json({ verified: true, message: 'پرداخت قبلاً تأیید شده', alreadyVerified: true });
      return;
    }

    if (!result.verified) {
      await orderService.updateStatus(orderId, 'PAYMENT_FAILED');
      res.json({ verified: false, message: 'پرداخت تأیید نشد' });
      return;
    }

    await orderService.updateStatus(orderId, 'PAID');

    try {
      await deliveryService.deliverBooks(orderId);
    } catch (deliveryError) {
      console.error('Delivery failed:', deliveryError);
    }

    res.json({ verified: true, message: 'پرداخت با موفقیت تأیید شد' });
  } catch (error) {
    next(error);
  }
}
