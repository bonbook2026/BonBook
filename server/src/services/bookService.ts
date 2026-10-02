import prisma from '../lib/prisma';
import { config } from '../config';

export class BookService {
  getUnitPrice(): number {
    const price = config.book.priceToman;
    if (!Number.isSafeInteger(price) || price <= 0) throw new Error('قیمت کتاب معتبر نیست');
    return price;
  }

  getMaxBooksPerOrder(): number {
    return config.book.maxBooksPerOrder;
  }

  async getActiveBooks() {
    return prisma.book.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBookById(id: number) {
    return prisma.book.findUnique({ where: { id } });
  }

  calculateTotal(quantity: number): { totalToman: number; totalIrr: number; unitPrice: number } {
    const unitPrice = this.getUnitPrice();
    const totalToman = quantity * unitPrice;
    return {
      unitPrice,
      totalToman,
      // The payment provider expects IRR; this is a fixed unit conversion, not FX.
      totalIrr: totalToman * 10,
    };
  }

  validateBookList(books: { title: string }[]): { valid: boolean; error?: string } {
    if (!books || books.length === 0) {
      return { valid: false, error: 'حداقل یک کتاب انتخاب کنید' };
    }

    if (books.length > this.getMaxBooksPerOrder()) {
      return { valid: false, error: `حداکثر ${this.getMaxBooksPerOrder()} کتاب در هر سفارش مجاز است` };
    }

    for (let i = 0; i < books.length; i++) {
      const title = books[i].title?.trim();
      if (!title) {
        return { valid: false, error: `نام کتاب شماره ${i + 1} خالی است` };
      }
    }

    return { valid: true };
  }
}
