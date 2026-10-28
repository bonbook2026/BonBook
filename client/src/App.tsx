import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useRef } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { NarrationProvider } from './hooks/useNarration';
import { ThemeProvider } from './hooks/useTheme';
import {SiteFeaturesProvider} from './hooks/useSiteFeatures';
import {SectionGate,SiteHome} from './components/SectionGate';
import {AdminSections} from './pages/AdminSections';
import {AdminLibraryHero} from './pages/AdminLibraryHero';
import { Library } from './pages/Library';
import { LibrarySearch } from './pages/LibrarySearch';
import { Reader } from './pages/Reader';
import { Login, GoogleComplete } from './pages/Login';
import { Admin, AdminBook, AdminAccess, AdminCategories } from './pages/Admin';
import { StoreFront } from './pages/StoreFront';
import { Profile } from './pages/Profile';
import { BookStore } from './pages/BookStore';
import { OrderSummary } from './pages/OrderSummary';
import { Orders } from './pages/Orders';
import { Success } from './pages/Success';
import { PaymentFailed } from './pages/PaymentFailed';
import { IS_DEMO, IS_PREPRODUCTION } from './config/demo';

function Protected({children,admin=false}:{children:ReactNode;admin?:boolean}){
  const {user,loading,logout,error}=useAuth(),location=useLocation();
  if(loading)return <div className="reading-loading" role="status">در حال بارگذاری حساب…</div>;
  if(!user&&error)return <div className="login-scene"><div className="login-card"><h1>دریافت حساب انجام نشد</h1><p role="alert">{error}</p><button className="reader-button" onClick={()=>window.location.reload()}>دوباره تلاش کن</button></div></div>;
  if(!user)return <Navigate to="/login" state={{next:location.pathname+location.search}} replace/>;
  if(admin&&user.role!=='OWNER'&&user.role!=='ADMIN')return <div className="login-scene"><div className="login-card"><h1>دسترسی مدیریت نداری</h1><p>با حسابی که مالک به‌عنوان ادمین ثبت کرده وارد شو.</p><button className="reader-button" onClick={logout}>خروج و تغییر حساب</button></div></div>;
  return <>{children}</>;
}
function AppContent(){
  const {initData}=useTelegram(),auth=useAuth(),attempted=useRef(false);
  useEffect(()=>{if(!IS_DEMO&&initData&&!auth.loading&&!attempted.current){attempted.current=true;void auth.login(initData).catch(()=>{});}},[initData,auth.loading,auth.login]);
  return <>{(IS_PREPRODUCTION||IS_DEMO)&&<div className="environment-banner"><span>{IS_DEMO?'نسخهٔ نمایشی · اطلاعات آزمایش در همین مرورگر':'پیش‌تولید بون‌بوک · پرداخت غیرفعال'}</span>{auth.user&&<button onClick={auth.logout}>خروج از حساب</button>}</div>}
  <Routes>
    <Route path="/" element={<SiteHome/>}/>
    <Route path="/dashboard" element={<SiteHome/>}/>
    <Route path="/library" element={<SectionGate section="library"><Library/></SectionGate>}/>
    <Route path="/search" element={<SectionGate section="search"><LibrarySearch/></SectionGate>}/>
    <Route path="/read/:bookId/:page" element={<SectionGate section="library"><Reader/></SectionGate>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/auth/complete" element={<GoogleComplete/>}/>
    <Route path="/shop" element={<SectionGate section="store"><StoreFront/></SectionGate>}/>
    <Route path="/profile" element={<SectionGate section="profile"><Protected><Profile/></Protected></SectionGate>}/>
    <Route path="/store" element={<SectionGate section="store"><Protected><BookStore/></Protected></SectionGate>}/>
    <Route path="/order-summary" element={<SectionGate section="store"><Protected><OrderSummary/></Protected></SectionGate>}/>
    <Route path="/orders" element={<SectionGate section="store"><Protected><Orders/></Protected></SectionGate>}/>
    <Route path="/success" element={<SectionGate section="store"><Protected><Success/></Protected></SectionGate>}/>
    <Route path="/payment-failed" element={<SectionGate section="store"><Protected><PaymentFailed/></Protected></SectionGate>}/>
    <Route path="/admin" element={<Protected admin><Admin/></Protected>}/>
    <Route path="/admin/books/:id" element={<Protected admin><AdminBook/></Protected>}/>
    <Route path="/admin/sections" element={<Protected admin><AdminSections/></Protected>}/>
    <Route path="/admin/library-hero" element={<Protected admin><AdminLibraryHero/></Protected>}/>
    <Route path="/admin/access" element={<Protected admin><AdminAccess/></Protected>}/>
    <Route path="/admin/categories" element={<Protected admin><AdminCategories/></Protected>}/>
    <Route path="*" element={<SiteHome/>}/>
  </Routes></>;
}
export default function App(){const Router=IS_DEMO?HashRouter:BrowserRouter;return <ThemeProvider><Router><AuthProvider><SiteFeaturesProvider><NarrationProvider><AppContent/></NarrationProvider></SiteFeaturesProvider></AuthProvider></Router></ThemeProvider>;}
