import { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  wide?: boolean;
}

const navigation = [
  { icon: 'book' as const, label: 'کتابخانه', path: '/library' },
  { icon: 'search' as const, label: 'جست‌وجو', path: '/search' },
  { icon: 'shop' as const, label: 'فروشگاه', path: '/shop' },
  { icon: 'user' as const, label: 'حساب کاربری', path: '/profile' },
];

export function Layout({ children, title, showBack, wide }: LayoutProps) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const items = user?.role === 'OWNER' || user?.role === 'ADMIN' ? [...navigation, {icon:'shield' as const,label:'مدیریت',path:'/admin'}] : navigation;
  const isDashboard = pathname === '/shop' || wide;
  const backPath = pathname === '/order-summary' ? '/store' : '/library';
  const inShop = ['/shop','/store','/orders','/order-summary','/success','/payment-failed'].includes(pathname);

  return (
    <div className="bookshop-shell">
      <header className="shop-header">
        <div className="shop-header-inner">
          <Link to="/library" className="shop-brand" aria-label="BonBook، کتابخانه">
            <span className="shop-brand-icon"><Icon name="book" /></span>
            <span>
              <span className="shop-wordmark" dir="ltr">BonBook<span className="text-brand-600">.</span></span>
              <span className="block text-[11px] text-gray-500 mt-1">بخوان. بشنو. پیدا کن.</span>
            </span>
          </Link>
          <nav aria-label="منوی اصلی" className="desktop-nav">
            {items.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => 'desktop-nav-link' + (isActive ? ' is-active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/profile" className="mobile-account" aria-label="حساب کاربری">
            <Icon name="user" className="w-5 h-5" />
          </Link>
        </div>
      </header>
      {inShop && <nav className="store-subnav" aria-label="منوی فروشگاه"><Link to="/shop">خانهٔ فروشگاه</Link><Link to="/store">خرید کتاب</Link><Link to="/orders">سفارش‌های من</Link></nav>}

      <main id="main-content" className={'shop-main' + (isDashboard ? '' : ' shop-main-narrow')}>
        {title && !isDashboard && (
          <div className="page-heading">
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            {showBack && (
              <Link to={backPath} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-700">
                بازگشت
                <Icon name="arrow" className="w-4 h-4 rotate-180" />
              </Link>
            )}
          </div>
        )}
        {children}
        <footer className="shop-footer">
          <Icon name="book" className="w-4 h-4" />
          <span>یک کتاب، یک شروع تازه.</span>
          <span className="shop-footer-brand" dir="ltr">BonBook</span>
        </footer>
      </main>

      <nav aria-label="ناوبری پایین صفحه" className="mobile-nav" style={{gridTemplateColumns:`repeat(${items.length},1fr)`}}>
        {items.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' is-active' : '')}>
            <Icon name={item.icon} className="w-[22px] h-[22px]" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
