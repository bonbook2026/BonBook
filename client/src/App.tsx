import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useRef } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { NarrationProvider } from './hooks/useNarration';
import { Library } from './pages/Library';
import { LibrarySearch } from './pages/LibrarySearch';
import { Reader } from './pages/Reader';
import { Login, GoogleComplete } from './pages/Login';
import { Admin, AdminBook, AdminAccess } from './pages/Admin';
import { StoreFront } from './pages/StoreFront';
import { Profile } from './pages/Profile';
import { BookStore } from './pages/BookStore';
import { OrderSummary } from './pages/OrderSummary';
import { Orders } from './pages/Orders';
import { Success } from './pages/Success';
import { PaymentFailed } from './pages/PaymentFailed';
import { IS_DEMO, IS_PREPRODUCTION } from './config/demo';

function Protected({children,admin=false}:{children:ReactNode;admin?:boolean}){
  const {user,loading,logout}=useAuth(),location=useLocation();
  if(loading)return <div className="reading-loading" role="status">در حال بارگذاری حساب…</div>;
  if(!user)return <Navigate to="/login" state={{next:location.pathname+location.search}} replace/>;
  if(admin&&user.role!=='OWNER'&&user.role!=='ADMIN')return <div className="login-scene"><div className="login-card"><h1>دسترسی مدیریت نداری</h1><p>با حسابی که مالک به‌عنوان ادمین ثبت کرده وارد شو.</p><button className="reader-button" onClick={logout}>خروج و تغییر حساب</button></div></div>;
  return <>{children}</>;
}
function AppContent(){
  const {initData}=useTelegram(),auth=useAuth(),attempted=useRef(false);
  useEffect(()=>{if(!IS_DEMO&&initData&&!auth.loading&&!attempted.current){attempted.current=true;void auth.login(initData).catch(()=>{});}},[initData,auth.loading,auth.login]);
  return <>{(IS_PREPRODUCTION||IS_DEMO)&&<div className="environment-banner"><span>{IS_DEMO?'نسخهٔ نمایشی · اطلاعات آزمایش در همین مرورگر':'پیش‌تولید بون‌بوک · پرداخت غیرفعال'}</span>{auth.user&&<button onClick={auth.logout}>خروج از حساب</button>}</div>}
  <Routes>
    <Route path="/" element={<Navigate to="/library" replace/>}/>
    <Route path="/dashboard" element={<Navigate to="/library" replace/>}/>
    <Route path="/library" element={<Library/>}/>
    <Route path="/search" element={<LibrarySearch/>}/>
    <Route path="/read/:bookId/:page" element={<Reader/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/auth/complete" element={<GoogleComplete/>}/>
    <Route path="/shop" element={<StoreFront/>}/>
    <Route path="/profile" element={<Protected><Profile/></Protected>}/>
    <Route path="/store" element={<Protected><BookStore/></Protected>}/>
    <Route path="/order-summary" element={<Protected><OrderSummary/></Protected>}/>
    <Route path="/orders" element={<Protected><Orders/></Protected>}/>
    <Route path="/success" element={<Protected><Success/></Protected>}/>
    <Route path="/payment-failed" element={<Protected><PaymentFailed/></Protected>}/>
    <Route path="/admin" element={<Protected admin><Admin/></Protected>}/>
    <Route path="/admin/books/:id" element={<Protected admin><AdminBook/></Protected>}/>
    <Route path="/admin/access" element={<Protected admin><AdminAccess/></Protected>}/>
    <Route path="*" element={<Navigate to="/library" replace/>}/>
  </Routes></>;
}
export default function App(){const Router=IS_DEMO?HashRouter:BrowserRouter;return <Router><AuthProvider><NarrationProvider><AppContent/></NarrationProvider></AuthProvider></Router>;}
