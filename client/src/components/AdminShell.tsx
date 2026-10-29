import {ReactNode} from 'react';
import {Link,NavLink} from 'react-router-dom';
import {Layout} from './Layout';
import {Icon} from './Icon';
import {useAuth} from '../hooks/useAuth';
export const bookStatus:Record<string,string>={DRAFT:'پیش‌نویس',PUBLISHED:'منتشرشده',HIDDEN:'مخفی',ARCHIVED:'بایگانی',TRASH:'سطل زباله'};
export function AdminShell({children}:{children:ReactNode}){const {user}=useAuth();return <Layout wide><div className="admin-heading"><div><p className="shop-eyebrow">پشت صحنهٔ بون‌بوک</p><h1>میز کار کتاب‌ها</h1></div><span className="role-badge"><Icon name="shield" className="w-4 h-4"/>{user?.role==='OWNER'?'مالک':'ادمین محتوا'}</span></div><nav className="admin-tabs"><NavLink to="/admin" end>کتاب‌ها و محتوا</NavLink><NavLink to="/admin/categories">دسته‌بندی‌ها</NavLink>{user?.role==='OWNER'&&<Link to="/admin/access">ادمین‌های کمکی</Link>}<NavLink to="/admin/sections">بخش‌های سایت</NavLink><NavLink to="/admin/library-hero">طراحی کتابخانه</NavLink>{user?.role==='OWNER'&&<NavLink to="/admin/content-security">امنیت محتوا</NavLink>}<Link to="/library">مشاهدهٔ کتابخانه</Link></nav>{children}</Layout>;}
