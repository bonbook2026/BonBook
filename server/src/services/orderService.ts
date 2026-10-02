import prisma from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus } from '../types';

interface CreateOrderParams {
  userId: number;
  books: { title: string }[];
  unitPriceToman: number;
  totalIrr: number;
}

export class OrderService {
  async createOrder(params: CreateOrderParams) {
    const orderNumber = `BB-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

    return prisma.order.create({
      data: {
        orderNumber,
        userId: params.userId,
        totalBooks: params.books.length,
        totalIrr: params.totalIrr,
        status: 'PENDING',
        items: {
          create: params.books.map((book) => ({
            bookTitle: book.title.trim(),
            priceToman: params.unitPriceToman,
          })),
        },
      },
      include: { items: true },
    });
  }

  async getOrderById(orderId: number) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true, deliveries: true },
    });
  }

  async getOrderByNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payments: true, deliveries: true },
    });
  }

  async getUserOrders(userId: number) {
    return prisma.order.findMany({
      where: { userId },
      include: { items: true, payments: true, deliveries: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(orderId: number, status: OrderStatus) {
    const updateData: Record<string, unknown> = { status };
    if (status === 'PAID') {
      updateData.paidAt = new Date();
    }
    return prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });
  }

  async isOrderOwnedByUser(orderId: number, userId: number): Promise<boolean> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    return !!order;
  }
}
