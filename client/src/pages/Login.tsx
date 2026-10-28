import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { api } from '../services/api';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { IS_DEMO } from '../config/demo';
export function Login(){
  const auth=useAuth(),{initData}=useTelegram(),location=useLocation(),navigate=useNavigate();
  const next=(location.state as {next?:string}|null)?.next||'/';
  const [options,setOptions]=useState({google:false,local:IS_DEMO});
  useEffect(()=>{if(!IS_DEMO)void Promise.all([api.auth.options(),api.auth.getLocalTelegramStatus()]).then(([o,l])=>setOptions({google:o.google,local:import.meta.env.DEV&&l.enabled})).catch(()=>{});},[]);
  useEffect(()=>{if(auth.user)navigate(next,{replace:true});},[auth.user,next,navigate]);
  return <div className="login-scene"><div className="login-topbar"><Link to="/" className="login-back">بازگشت به سایت <Icon name="arrow" className="w-4 h-4"/></Link><ThemeToggle/></div><div className="login-card">
    <div className="login-symbol"><Icon name="book" className="w-8 h-8"/></div><p className="shop-eyebrow" dir="ltr">YOUR NEXT CHAPTER</p><h1>به بون‌بوک خوش آمدی</h1><p>یک حساب، برای خواندن، شنیدن و ساختن کتاب‌ها.</p>
    {auth.error&&<p role="alert" className="notice error">{auth.error}</p>}
    {new URLSearchParams(location.search).has('error')&&<p role="alert" className="notice error">ورود با گوگل کامل نشد. دوباره تلاش کنید.</p>}
    {initData&&!IS_DEMO?<button className="reader-button primary" disabled={auth.loading} onClick={()=>{void auth.login(initData).catch(()=>{});}}>ورود با حساب تلگرام</button>:<a className="reader-button primary" href="https://t.me/BonBook_bot" target="_blank" rel="noopener noreferrer">ورود از طریق بات تلگرام <Icon name="arrow" className="w-4 h-4"/></a>}
    <div className="login-divider"><span>یا در مرورگر</span></div>
    <a className={`reader-button google-button ${!options.google?'is-disabled':''}`} href={options.google?`/api/auth/google/start?next=${encodeURIComponent(next)}`:undefined} aria-disabled={!options.google}><span className="google-g" dir="ltr">G</span>ادامه با حساب گوگل</a>
    {!options.google&&<span className="login-note">ورود با گوگل فعلاً در دسترس نیست.</span>}
    {options.local&&<button className="reader-button" onClick={()=>{void auth.loginLocally().then(()=>navigate(next,{replace:true})).catch(()=>{});}}>ورود آزمایشی تلگرام</button>}
    <p className="login-note">برای مدیریت کتاب‌ها، با حساب مالک یا ادمین وارد شوید.</p>
  </div><span className="login-signature" dir="ltr">BonBook — A quieter place to read.</span></div>;
}
export function GoogleComplete(){
  const auth=useAuth(),navigate=useNavigate(),started=useRef(false);
  useEffect(()=>{if(started.current)return;started.current=true;const requested=new URLSearchParams(window.location.search).get('next')||'/library';const next=requested.startsWith('/')&&!requested.startsWith('//')&&!requested.includes('\\')?requested:'/library';void auth.completeGoogle().then(()=>navigate(next,{replace:true})).catch(()=>navigate('/login?error=google_failed',{replace:true}));},[auth,navigate]);
  return <div className="reading-loading" role="status">در حال ورود به حساب…</div>;
}
