import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../services/userService';
import { BookService } from '../services/bookService';
import { OrderService } from '../services/orderService';
import { ExchangeRateService } from '../services/exchangeRateService';
import { createExchangeRateProvider } from '../providers/exchangeRate';

const userService = new UserService();
const bookService = new BookService();
const orderService = new OrderService();
const exchangeRateService = new ExchangeRateService(createExchangeRateProvider());

export async function createOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { books } = req.body;

    const user = await userService.getById(req.userId!);
    if (!user) {
      res.status(404).json({ error: 'کاربر یافت نشد' });
      return;
    }

    const profileStatus = userService.isProfileComplete(user);
    if (!profileStatus.complete) {
      res.status(400).json({
        error: 'پروفایل ناقص است',
        missingFields: profileStatus.missing,
        redirectTo: '/profile',
      });
      return;
    }

    const validation = bookService.validateBookList(books);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { totalUsd, unitPrice } = bookService.calculateTotal(books.length);

    let rateResult;
    try {
      rateResult = await exchangeRateService.getCurrentRate();
    } catch {
      res.status(503).json({ error: 'در حال حاضر امکان دریافت نرخ ارز وجود ندارد. لطفاً چند لحظه بعد دوباره تلاش کنید.' });
      return;
    }

    const totalIrr = exchangeRateService.calculateIrrTotal(totalUsd, rateResult.rate);

    const order = await orderService.createOrder({
      userId: user.id,
      books,
      unitPriceUsd: unitPrice,
      totalUsd,
      exchangeRate: rateResult.rate,
      totalIrr,
    });

    res.status(201).json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        books: order.items.map((item) => ({ title: item.bookTitle, priceUsd: item.priceUsd })),
        totalBooks: order.totalBooks,
        totalUsd: order.totalUsd,
        exchangeRate: order.exchangeRate,
        totalIrr: order.totalIrr,
        status: order.status,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getExchangeRate(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rateResult = await exchangeRateService.getCurrentRate();
    res.json({
      rate: rateResult.rate,
      source: rateResult.source,
      timestamp: rateResult.timestamp,
    });
  } catch {
    res.status(503).json({ error: 'در حال حاضر امکان دریافت نرخ ارز وجود ندارد. لطفاً چند لحظه بعد دوباره تلاش کنید.' });
  }
}

export async function getOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id as string, 10);
    if (isNaN(orderId)) {
      res.status(400).json({ error: 'شناسه سفارش نامعتبر است' });
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

    res.json({ order });
  } catch (error) {
    next(error);
  }
}

export async function getUserOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const orders = await orderService.getUserOrders(req.userId!);
    res.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalBooks: o.totalBooks,
        totalUsd: o.totalUsd,
        totalIrr: o.totalIrr,
        status: o.status,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        deliveryStatus: o.deliveries[0]?.status || null,
      })),
    });
  } catch (error) {
    next(error);
  }
}
