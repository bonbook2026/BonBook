import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Icon } from '../components/Icon';

const steps = [
  { number: '۰۱', title: 'کتاب‌هایت را انتخاب کن', text: 'نام کتاب‌های مورد نظرت را در فهرست خرید بنویس.' },
  { number: '۰۲', title: 'سفارشت را مرور کن', text: 'عنوان‌ها و مبلغ نهایی را پیش از پرداخت بررسی کن.' },
  { number: '۰۳', title: 'در ایمیلت دریافت کن', text: 'بعد از پرداخت، کتاب‌ها به ایمیل ثبت‌شده ارسال می‌شوند.' },
];

export function Dashboard() {
  return (
    <Layout title="BonBook">
      <section className="bookshop-hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="hero-eyebrow"><span /> به کتاب‌فروشی ما خوش آمدی</p>
          <h1 id="hero-heading">یک کتاب،<br /><span>یک دنیای تازه.</span></h1>
          <p className="hero-description">کتاب بعدی‌ات را انتخاب کن.<br />ماجراجویی از همین‌جا شروع می‌شود.</p>
        </div>
        <div className="hero-visual">
          <div className="hero-circle" aria-hidden="true" />
          <img src="/images/bonbook-cover.png" alt="کتاب آبی با نوشتهٔ BonBook روی جلد" className="hero-book" fetchPriority="high" />
          <div className="hero-book-caption"><span className="hero-caption-line" /><span dir="ltr">A new chapter.</span><span className="hero-caption-line" /></div>
        </div>
        <Link to="/store" className="shop-button hero-cta">
          شروع خرید کتاب
          <Icon name="arrow" className="w-5 h-5" />
        </Link>
        <span className="hero-corner-label" aria-hidden="true" dir="ltr">THE BOOK CORNER / BONBOOK</span>
      </section>

      <section className="mt-9" aria-labelledby="my-bookshop-heading">
        <div className="section-heading">
          <h2 id="my-bookshop-heading">کتاب‌فروشی من</h2>
          <span>همه‌چیز برای خرید بعدی</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/orders" className="shop-action-card">
            <span className="shop-action-icon"><Icon name="orders" className="w-7 h-7" /></span>
            <div className="flex-1 min-w-0">
              <h3>سفارش‌های من</h3>
              <p>وضعیت خریدها و ارسال کتاب‌ها</p>
            </div>
            <Icon name="arrow" className="w-5 h-5 text-gray-400" />
          </Link>
          <Link to="/profile" className="shop-action-card">
            <span className="shop-action-icon shop-action-icon-sage"><Icon name="user" className="w-7 h-7" /></span>
            <div className="flex-1 min-w-0">
              <h3>حساب کاربری</h3>
              <p>نام، اطلاعات شخصی و ایمیل دریافت</p>
            </div>
            <Icon name="arrow" className="w-5 h-5 text-gray-400" />
          </Link>
        </div>
      </section>

      <section className="buying-guide" aria-labelledby="guide-heading">
        <div className="section-heading"><h2 id="guide-heading">از انتخاب تا خواندن</h2><span>فقط سه قدم</span></div>
        <ol className="guide-steps">
          {steps.map((step) => (
            <li key={step.number}>
              <span className="guide-number">{step.number}</span>
              <div><h3>{step.title}</h3><p>{step.text}</p></div>
            </li>
          ))}
        </ol>
      </section>
    </Layout>
  );
}
