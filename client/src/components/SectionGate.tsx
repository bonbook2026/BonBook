import {ReactNode} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useSiteFeatures} from '../hooks/useSiteFeatures';
import {useAuth} from '../hooks/useAuth';
import {sectionLabels,SiteSection} from '../types/siteSettings';
import {Layout} from './Layout';
import {Icon} from './Icon';

function SectionUnavailable({section}:{section?:SiteSection}){
  const {home}=useSiteFeatures(),{user,logout}=useAuth();
  return <Layout><section className="section-unavailable"><Icon name="book"/><h1>{section?`${sectionLabels[section]} فعلاً در دسترس نیست`:'بون‌بوک در حال آماده‌شدن است'}</h1><p>{section?'این بخش توسط مدیریت موقتاً غیرفعال شده است.':'به‌زودی بخش‌های سایت در دسترس قرار می‌گیرند.'}</p><div>{home&&<Link className="reader-button primary" to={home}>بازگشت به سایت</Link>}{!user?<Link className="reader-button" to="/login">ورود به حساب</Link>:<button className="reader-button" onClick={logout}>خروج و ورود با حساب دیگر</button>}</div></section></Layout>;
}
function SettingsPending(){const {error,refresh}=useSiteFeatures();return <Layout><div className="section-unavailable" role={error?'alert':'status'}>{error?<><h1>دریافت تنظیمات سایت انجام نشد</h1><p>{error}</p><button className="reader-button" onClick={()=>void refresh()}>تلاش دوباره</button></>:'در حال آماده‌کردن سایت…'}</div></Layout>;}
export function SectionGate({section,children}:{section:SiteSection;children:ReactNode}){
  const state=useSiteFeatures();
  if(state.loading||!state.features&&!state.isAdmin)return <SettingsPending/>;
  if(!state.canAccess(section))return <SectionUnavailable section={section}/>;
  const hidden=state.features&&(!state.features[section]||section==='search'&&!state.features.library);
  return <>{state.isAdmin&&hidden&&<aside className="admin-section-preview">این بخش برای کاربران خاموش است؛ نمای ادمین را می‌بینی. <Link to="/admin/sections">تنظیم دسترسی بخش‌ها</Link></aside>}{children}</>;
}
export function SiteHome(){const state=useSiteFeatures();if(state.loading||!state.features&&!state.isAdmin)return <SettingsPending/>;return state.home?<Navigate to={state.home} replace/>:<SectionUnavailable/>;}
