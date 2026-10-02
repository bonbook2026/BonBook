import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserService } from '../services/userService';
import { BookService } from '../services/bookService';
import { OrderService } from '../services/orderService';

const userService = new UserService();
const bookService = new BookService();
const orderService = new OrderService();

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

    const { unitPrice, totalIrr } = bookService.calculateTotal(books.length);

    const order = await orderService.createOrder({
      userId: user.id,
      books,
      unitPriceToman: unitPrice,
      totalIrr,
    });

    res.status(201).json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        books: order.items.map((item) => ({ title: item.bookTitle, priceToman: item.priceToman })),
        totalBooks: order.totalBooks,
        totalToman: order.totalIrr / 10,
        totalIrr: order.totalIrr,
        status: order.status,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        deliveryStatus: null,
      },
    });
  } catch (error) {
    next(error);
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
        totalToman: o.totalIrr / 10,
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
