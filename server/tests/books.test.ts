import { describe, it, expect } from 'vitest';
import { BookService } from '../src/services/bookService';

describe('BookService', () => {
  const bookService = new BookService();

  describe('calculateTotal', () => {
    it('should calculate for 1 book', () => {
      const result = bookService.calculateTotal(1);
      expect(result.totalUsd).toBe(8);
      expect(result.unitPrice).toBe(8);
    });

    it('should calculate for 2 books', () => {
      const result = bookService.calculateTotal(2);
      expect(result.totalUsd).toBe(16);
    });

    it('should calculate for 10 books', () => {
      const result = bookService.calculateTotal(10);
      expect(result.totalUsd).toBe(80);
    });
  });

  describe('validateBookList', () => {
    it('should accept one valid book', () => {
      const result = bookService.validateBookList([{ title: 'Book A' }]);
      expect(result.valid).toBe(true);
    });

    it('should accept multiple valid books', () => {
      const result = bookService.validateBookList([
        { title: 'Book A' },
        { title: 'Book B' },
        { title: 'Book C' },
      ]);
      expect(result.valid).toBe(true);
    });

    it('should reject empty list', () => {
      const result = bookService.validateBookList([]);
      expect(result.valid).toBe(false);
    });

    it('should reject book with empty title', () => {
      const result = bookService.validateBookList([{ title: '' }]);
      expect(result.valid).toBe(false);
    });

    it('should reject book with whitespace-only title', () => {
      const result = bookService.validateBookList([{ title: '   ' }]);
      expect(result.valid).toBe(false);
    });
  });
});
