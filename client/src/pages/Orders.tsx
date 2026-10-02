import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icon } from '../components/Icon';
import { api } from '../services/api';
import { formatToman } from '../utils/money';

interface OrderItem {
  id: number;
  orderNumber: string;
  totalBooks: number;
  totalIrr: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  deliveryStatus: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'در انتظار', color: 'bg-yellow-100 text-yellow-800' },
  PAYMENT_PROCESSING: { label: 'در حال پرداخت', color: 'bg-blue-100 text-blue-800' },
  PAID: { label: 'پرداخت شده', color: 'bg-green-100 text-green-800' },
  PAYMENT_FAILED: { label: 'پرداخت ناموفق', color: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'لغو شده', color: 'bg-gray-100 text-gray-800' },
  DELIVERY_PENDING: { label: 'در انتظار ارسال', color: 'bg-orange-100 text-orange-800' },
  DELIVERED: { label: 'ارسال شده', color: 'bg-green-100 text-green-800' },
  DELIVERY_FAILED: { label: 'خطا در ارسال', color: 'bg-red-100 text-red-800' },
};

export function Orders() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.orders.getAll();
      setOrders(result.orders);
    } catch {
      setError('دریافت سفارش‌ها ممکن نشد. لطفاً دوباره تلاش کن.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const formatNumber = (value: number) => value.toLocaleString('fa-IR');

  return (
    <Layout title="سفارش‌های من" showBack>
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16" role="status">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">در حال دریافت سفارش‌ها...</p>
        </div>
      ) : error ? (
        <div className="empty-orders">
          <p role="alert">{error}</p>
          <button className="shop-button" onClick={() => { void loadOrders(); }}>تلاش دوباره</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-orders">
          <div className="empty-orders-icon"><Icon name="book" className="w-10 h-10" /></div>
          <h2>جای اولین کتابت اینجاست</h2>
          <p>هنوز سفارشی ثبت نکرده‌ای.<br />با انتخاب کتاب‌های مورد علاقه‌ات، اولین فصل را شروع کن.</p>
          <Link to="/store" className="shop-button">شروع خرید کتاب<Icon name="arrow" className="w-5 h-5" /></Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-5">وضعیت پرداخت و ارسال کتاب‌هایت را از اینجا دنبال کن.</p>
          {orders.map((order) => {
            const statusInfo = statusLabels[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
            const deliveryInfo = order.deliveryStatus ? statusLabels[order.deliveryStatus] : null;

            return (
              <article key={order.id} className="book-entry-card">
                <div className="flex justify-between items-start gap-4 mb-5">
                  <div>
                    <h2 className="font-mono text-sm text-gray-800" dir="ltr">{order.orderNumber}</h2>
                    <time dateTime={order.createdAt} className="text-[11px] text-gray-500">{new Date(order.createdAt).toLocaleDateString('fa-IR')}</time>
                  </div>
                  <span className={'text-xs px-3 py-1 rounded-full font-medium ' + statusInfo.color}>{statusInfo.label}</span>
                </div>
                <div className="flex justify-between items-center gap-4 text-sm">
                  <span className="text-gray-500">{formatNumber(order.totalBooks)} کتاب</span>
                  <span className="font-semibold text-gray-800">{formatToman(order.totalIrr / 10)}</span>
                </div>
                {deliveryInfo && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <span className={'text-xs px-3 py-1 rounded-full font-medium ' + deliveryInfo.color}>{deliveryInfo.label}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
