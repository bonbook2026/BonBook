import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icon } from '../components/Icon';
import { PurchaseSteps } from '../components/PurchaseSteps';
import { api } from '../services/api';
import { BookEntry, BookInfo } from '../types';
import { formatToman } from '../utils/money';

let idCounter = 0;

export function BookStore() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookEntry[]>(() => [{ id: String(++idCounter), title: '' }]);
  const [info, setInfo] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await api.books.getInfo());
    } catch {
      setError('اطلاعات قیمت دریافت نشد. برای ادامهٔ خرید، دوباره تلاش کن.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadInfo(); }, [loadInfo]);

  const addBook = () => {
    if (!info || books.length >= info.maxBooksPerOrder) return;
    setBooks([...books, { id: String(++idCounter), title: '' }]);
  };

  const removeBook = (id: string) => {
    if (books.length <= 1) return;
    setBooks(books.filter((book) => book.id !== id));
  };

  const updateTitle = (id: string, title: string) => {
    setBooks(books.map((book) => book.id === id ? { ...book, title } : book));
  };

  const allFilled = books.every((book) => book.title.trim());

  const handleCheckout = () => {
    if (!allFilled || !info) return;
    navigate('/order-summary', { state: { books: books.map((book) => ({ title: book.title.trim() })) } });
  };

  if (loading) {
    return (
      <Layout title="خرید کتاب" showBack>
        <div className="flex flex-col items-center gap-4 py-16" role="status">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">در حال آماده‌کردن فهرست خرید...</p>
        </div>
      </Layout>
    );
  }

  if (error || !info) {
    return (
      <Layout title="خرید کتاب" showBack>
        <div className="empty-orders">
          <p role="alert">{error || 'اطلاعات خرید در دسترس نیست.'}</p>
          <button className="shop-button" onClick={() => { void loadInfo(); }}>تلاش دوباره</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="خرید کتاب" showBack>
      <div className="page-intro">
        <span className="shop-eyebrow">فهرست خرید تو</span>
        <h2>کدام کتاب‌ها را می‌خواهی؟</h2>
        <p>عنوان دقیق هر کتاب را بنویس و فهرستت را برای مرور سفارش آماده کن.</p>
      </div>

      <PurchaseSteps current={1} />

      <form onSubmit={(event) => { event.preventDefault(); handleCheckout(); }} className="book-order-grid">
        <div className="space-y-4">
          {books.map((book, index) => (
            <div key={book.id} className="book-entry-card">
              <div className="book-entry-heading">
                <label htmlFor={'book-title-' + book.id} className="book-entry-label">
                  <span className="book-entry-mark"><Icon name="book" className="w-5 h-5" /></span>
                  عنوان کتاب {(index + 1).toLocaleString('fa-IR')}
                </label>
                {books.length > 1 && (
                  <button type="button" onClick={() => removeBook(book.id)} className="remove-book-button" aria-label={'حذف کتاب ' + (index + 1).toLocaleString('fa-IR')}>حذف</button>
                )}
              </div>
              <input
                id={'book-title-' + book.id}
                type="text"
                value={book.title}
                onChange={(event) => updateTitle(book.id, event.target.value)}
                placeholder="مثلاً: نام کتاب و نویسنده"
                className="book-title-input"
                required
              />
            </div>
          ))}

          {books.length < info.maxBooksPerOrder ? (
            <button type="button" onClick={addBook} className="add-book-button">
              <Icon name="plus" className="w-5 h-5" />
              اضافه کردن یک کتاب دیگر
            </button>
          ) : (
            <p className="text-xs text-gray-500" role="status">حداکثر تعداد کتاب در هر سفارش: {info.maxBooksPerOrder.toLocaleString('fa-IR')}</p>
          )}
        </div>

        <aside className="order-basket" aria-label="سبد کتاب‌ها">
          <h2 className="basket-heading"><Icon name="book" className="w-5 h-5 text-brand-600" />سبد کتاب‌های تو</h2>
          <div className="basket-row"><span>تعداد کتاب‌ها</span><strong className="text-gray-800">{books.length.toLocaleString('fa-IR')} کتاب</strong></div>
          <div className="basket-row"><span>قیمت هر کتاب</span><strong className="text-gray-800">{formatToman(info.unitPriceToman)}</strong></div>
          <div className="basket-row basket-total flex-wrap gap-y-2">
            <span>جمع فهرست خرید</span>
            <strong className="text-2xl text-brand-600" aria-live="polite">{formatToman(books.length * info.unitPriceToman)}</strong>
          </div>
          <button type="submit" disabled={!allFilled} className="shop-button w-full">
            مرور سفارش
            <Icon name="arrow" className="w-5 h-5" />
          </button>
          {!allFilled && <p className="text-[11px] text-gray-500 mt-3 text-center">برای ادامه، نام همهٔ کتاب‌ها را وارد کن.</p>}
          <p className="basket-help"><Icon name="mail" className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>کتاب‌ها به ایمیل حساب کاربری ارسال می‌شوند. مبلغ نهایی را در مرحلهٔ بعد مرور کن.</span></p>
        </aside>
      </form>
    </Layout>
  );
}
