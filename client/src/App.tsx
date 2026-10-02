import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useAuth } from './hooks/useAuth';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { BookStore } from './pages/BookStore';
import { OrderSummary } from './pages/OrderSummary';
import { Orders } from './pages/Orders';
import { Success } from './pages/Success';
import { PaymentFailed } from './pages/PaymentFailed';
import { api } from './services/api';

function AppContent() {
  const { initData } = useTelegram();
  const { user, loading, error, login, loginLocally, logout } = useAuth();
  const navigate = useNavigate();
  const [authAttempted, setAuthAttempted] = useState(false);
  const [localLoginEnabled, setLocalLoginEnabled] = useState(false);
  const isLocalBrowser = import.meta.env.DEV &&
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  useEffect(() => {
    if (!isLocalBrowser || initData) return;
    let active = true;
    api.auth.getLocalTelegramStatus()
      .then(({ enabled }) => { if (active) setLocalLoginEnabled(enabled); })
      .catch(() => { if (active) setLocalLoginEnabled(false); });
    return () => { active = false; };
  }, [isLocalBrowser, initData]);

  useEffect(() => {
    if (authAttempted || loading) return;

    if (!user && initData) {
      login(initData)
        .catch(() => {})
        .finally(() => setAuthAttempted(true));
    } else {
      setAuthAttempted(true);
    }
  }, [user, initData, loading, login, authAttempted]);

  if (loading || (!authAttempted && initData)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!user && authAttempted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm rounded-2xl bg-white border border-gray-100 p-8 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-5">
            <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2" dir="ltr">BonBook</h1>
          {isLocalBrowser && localLoginEnabled ? (
            <>
              <p className="text-gray-600 text-sm leading-7 mb-5">
                برای تست فروشگاه بدون باز کردن تلگرام، با حساب آزمایشی وارد شوید.
              </p>
              {error && <p role="alert" className="text-red-600 text-sm mb-4">{error}</p>}
              <button
                onClick={() => { loginLocally().catch(() => {}); }}
                className="w-full bg-brand-600 text-white rounded-xl px-4 py-3 font-medium hover:bg-brand-700 transition-colors"
              >
                ورود آزمایشی تلگرام
              </button>
              <p className="text-xs text-gray-400 mt-4 leading-6">حساب آزمایشی به تلگرام متصل نیست.</p>
            </>
          ) : error ? (
            <p role="alert" className="text-red-500 text-sm mb-4">{error}</p>
          ) : (
            <p className="text-gray-500 text-sm mb-4">
              لطفاً از طریق Telegram وارد شوید.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    {isLocalBrowser && user?.telegramId === 'local:telegram:bonbook' && (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-900">
        <span>حساب آزمایشی تلگرام</span>
        <button onClick={() => { logout(); navigate('/', { replace: true }); }} className="rounded-lg px-3 py-1.5 font-medium hover:bg-amber-100">
          خروج از حساب آزمایشی
        </button>
      </div>
    )}
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/store" element={<BookStore />} />
      <Route path="/order-summary" element={<OrderSummary />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/success" element={<Success />} />
      <Route path="/payment-failed" element={<PaymentFailed />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
