import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma';
import { createOrder } from '../src/controllers/orderController';
import { BookService } from '../src/services/bookService';
import { config } from '../src/config';
import type { AuthRequest } from '../src/middleware/auth';
import type { Response } from 'express';

vi.mock('../src/lib/prisma', () => ({ default: {
  user: { findUnique: vi.fn() },
  order: { create: vi.fn() },
} }));

describe('Fixed Toman checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.book.priceToman = 1500000;
  });

  it('uses server pricing, ignores supplied totals, and stores the correct payment amount', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 1, telegramId: 'test', firstName: 'Test', lastName: 'Reader', email: 'reader@example.com',
      createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(prisma.order.create).mockImplementation(async (input: any) => ({
      id: 1, ...input.data, items: input.data.items.create,
    }) as any);
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json } as unknown as Response;
    const next = vi.fn();
    const req = { userId: 1, body: {
      books: [{ title: 'Book A' }, { title: 'Book B' }],
      totalIrr: 1, totalToman: 1, exchangeRate: 1, unitPriceToman: 1,
    } } as unknown as AuthRequest;
    await createOrder(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      totalBooks: 2, totalIrr: 30000000,
      items: { create: [
        { bookTitle: 'Book A', priceToman: 1500000 },
        { bookTitle: 'Book B', priceToman: 1500000 },
      ] },
    }) }));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ order: expect.objectContaining({
      totalToman: 3000000, totalIrr: 30000000,
    }) }));
  });

  it('rejects invalid configured prices instead of charging an incorrect amount', () => {
    for (const price of [0, -1, 1.5, NaN]) {
      config.book.priceToman = price;
      expect(() => new BookService().calculateTotal(1)).toThrow();
    }
  });
});
