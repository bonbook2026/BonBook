import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BookService } from '../services/bookService';

const bookService = new BookService();

export async function getBookInfo(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({
      unitPriceToman: bookService.getUnitPrice(),
      maxBooksPerOrder: bookService.getMaxBooksPerOrder(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getBooks(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const books = await bookService.getActiveBooks();
    res.json({ books });
  } catch (error) {
    next(error);
  }
}
