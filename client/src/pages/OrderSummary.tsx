import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PurchaseSteps } from '../components/PurchaseSteps';
import { api } from '../services/api';

export function OrderSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const books: { title: string }[] = location.state?.books || [];
  const [rate, setRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitPrice, setUnitPrice] = useState(8);

  useEffect(() => {
    if (books.length === 0) {
      navigate('/store');
      return;
    }

    Promise.all([api.orders.getExchangeRate(), api.books.getInfo()])
      .then(([rateResult, bookInfo]) => {
        setRate(rateResult.rate);
        setUnitPrice(bookInfo.unitPriceUsd);
        setLoadingRate(false);
      })
      .catch(() => {
        setError('در حال حاضر امکان دریافت نرخ ارز وجود ندارد. لطفاً چند لحظه بعد دوباره تلاش کنید.');
        setLoadingRate(false);
      });
  }, [books.length, navigate]);

  const totalUsd = books.length * unitPrice;
  const totalIrr = rate ? totalUsd * rate : 0;

  const formatNumber = (n: number) => n.toLocaleString('fa-IR');

  const handlePay = async () => {
    setError(null);
    setCreating(true);

    try {
      const result = await api.orders.create(books);
      const order = result.order;

      const paymentResult = await api.payments.initiate(order.id);
      window.location.href = paymentResult.paymentUrl;
    } catch (err) {
      const errData = err instanceof Error ? err.message : 'خطا در ایجاد سفارش';
      if (errData.includes('پروفایل ناقص') || errData.includes('redirectTo')) {
        navigate('/profile');
        return;
      }
      setError(errData);
      setCreating(false);
    }
  };

  if (loadingRate) {
    return (
      <Layout title="خلاصه سفارش" showBack>
        <PurchaseSteps current={2} />
        <div className="flex justify-center py-12" role="status" aria-label="در حال آماده‌کردن خلاصهٔ سفارش">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="خلاصه سفارش" showBack>
      <PurchaseSteps current={2} />
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">BonBook</h2>

          <div className="mb-3">
            <h3 className="text-sm font-medium text-gray-500 mb-2">کتاب‌ها:</h3>
            <ol className="space-y-1 pr-4">
              {books.map((book, i) => (
                <li key={i} className="text-gray-800 list-decimal">
                  {book.title}
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">تعداد</span>
              <span className="font-medium">{books.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">قیمت هر کتاب</span>
              <span className="font-medium" dir="ltr">${unitPrice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">جمع</span>
              <span className="font-bold" dir="ltr">${totalUsd}</span>
            </div>
            {rate && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">نرخ دلار</span>
                  <span className="font-medium">{formatNumber(rate)} ریال</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <span className="text-gray-700 font-medium">مبلغ قابل پرداخت</span>
                  <span className="font-bold text-lg text-brand-600">{formatNumber(totalIrr)} ریال</span>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{error}</div>
        )}

        <button
          onClick={handlePay}
          disabled={creating || !rate}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 active:bg-brand-800 transition-colors disabled:opacity-50"
        >
          {creating ? 'در حال پردازش...' : 'پرداخت'}
        </button>
      </div>
    </Layout>
  );
}
