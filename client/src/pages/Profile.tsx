import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../services/api';
import { User } from '../types';
import { IS_DEMO } from '../config/demo';

export function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.users.getProfile().then((result) => {
      setUser(result.user);
      setFirstName(result.user.firstName || '');
      setLastName(result.user.lastName || '');
      setEmail(result.user.email || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);

    try {
      const result = await api.users.updateProfile({ firstName, lastName, email });
      setUser(result.user);
      setMessage({ type: 'success', text: 'اطلاعات با موفقیت ذخیره شد' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'خطا در ذخیره اطلاعات' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="پروفایل" showBack>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="پروفایل" showBack>
      <div className="page-intro">
        <span className="shop-eyebrow">حساب کتاب‌فروشی تو</span>
        <h2>برای دریافت کتاب‌ها آماده شو</h2>
        <p>نام و ایمیل دریافت کتاب‌ها را اینجا کامل کن تا هنگام خرید آماده باشند.</p>
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-500 mb-1">Telegram ID</label>
          <div className="text-gray-900 font-mono bg-gray-50 rounded-lg px-3 py-2" dir="ltr">
            {user?.telegramId}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <label htmlFor="profile-first-name" className="block text-sm font-medium text-gray-700 mb-1">نام</label>
            <input
              id="profile-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="نام خود را وارد کنید"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="profile-last-name" className="block text-sm font-medium text-gray-700 mb-1">نام خانوادگی</label>
            <input
              id="profile-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="نام خانوادگی خود را وارد کنید"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1">{IS_DEMO ? 'ایمیل آزمایشی' : 'ایمیل دریافت کتاب (Gmail)'}</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={IS_DEMO ? 'reader@example.com' : 'example@gmail.com'}
              dir="ltr"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-left"
            />
          </div>
        </div>

        {message && (
          <div className={`rounded-xl p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-medium hover:bg-brand-700 active:bg-brand-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'در حال ذخیره...' : 'ذخیره اطلاعات'}
        </button>
      </div>
    </Layout>
  );
}
