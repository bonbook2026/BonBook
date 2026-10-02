import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

export function PaymentFailed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderNumber = searchParams.get('order');

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">پرداخت انجام نشد</h1>

        {orderNumber && (
          <p className="text-gray-500 mb-4 font-mono text-sm">{orderNumber}</p>
        )}

        <p className="text-gray-600 mb-8">لطفاً دوباره تلاش کنید.</p>

        <div className="space-y-3 w-full max-w-xs">
          <button
            onClick={() => navigate('/orders')}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 transition-colors"
          >
            مشاهده سفارش‌ها
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            بازگشت به خانه
          </button>
        </div>
      </div>
    </Layout>
  );
}
