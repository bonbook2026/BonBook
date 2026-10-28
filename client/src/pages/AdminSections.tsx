import {useEffect,useState} from 'react';
import {AdminShell} from '../components/AdminShell';
import {Icon} from '../components/Icon';
import {api} from '../services/api';
import {useSiteFeatures} from '../hooks/useSiteFeatures';
import {sectionLabels,SiteFeatures,SiteSection} from '../types/siteSettings';

const sections=[
  {key:'library' as const,icon:'book' as const,description:'کتابخانه، باز کردن کتاب‌ها، متن صفحه‌ها و فایل‌های کتاب. با خاموش‌شدن کتابخانه، جست‌وجوی کتاب‌ها هم در دسترس کاربران نیست.'},
  {key:'search' as const,icon:'search' as const,description:'جست‌وجوی موضوع و سؤال در متن کتاب‌ها، در کتابخانه و کتاب‌خوان. برای استفاده، کتابخانه هم باید روشن باشد.'},
  {key:'store' as const,icon:'shop' as const,description:'خانهٔ فروشگاه، خرید کتاب، ثبت سفارش و سفارش‌های من.'},
  {key:'profile' as const,icon:'user' as const,description:'صفحهٔ حساب کاربری و ویرایش اطلاعات شخصی. ورود و خروج از حساب همیشه در دسترس می‌ماند؛ خرید به اطلاعات کامل حساب نیاز دارد.'},
];
export function AdminSections(){
  const {apply}=useSiteFeatures(),[features,setFeatures]=useState<SiteFeatures|null>(null),[busy,setBusy]=useState<SiteSection|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setError('');void api.admin.sections().then(result=>{if(live){setFeatures(result.features);apply(result.features);}}).catch(error=>{if(live)setError(error.message);});return()=>{live=false;};},[retry,apply]);
  const toggle=async(key:SiteSection)=>{
    if(!features||busy)return;setBusy(key);setError('');setNotice('');
    try{const result=await api.admin.setSection(key,!features[key]);setFeatures(result.features);apply(result.features);setNotice(`${sectionLabels[key]} برای کاربران ${result.features[key]?'روشن':'خاموش'} شد.`);}
    catch(error){setError(error instanceof Error?error.message:'ذخیرهٔ تنظیم انجام نشد.');}finally{setBusy(null);}
  };
  return <AdminShell><section className="admin-site-settings"><div className="settings-intro"><span className="shop-eyebrow">کنترل بخش‌های بون‌بوک</span><h2>چه بخش‌هایی در دسترس کاربران باشد؟</h2><p>هر سوییچ بلافاصله ذخیره می‌شود. بخش خاموش از منو پنهان و دسترسی مستقیم کاربران به آن بسته می‌شود. محتوا و تنظیمات آن محفوظ می‌ماند.</p></div><div className="settings-admin-note"><Icon name="shield"/><p>ادمین و مالک برای بررسی و ویرایش، به همهٔ بخش‌ها دسترسی دارند؛ حتی بخش خاموش. ورود و پنل مدیریت همیشه فعال می‌مانند.</p></div>
    {error&&<div className="notice error" role="alert">{error}{!features&&<button className="reader-button" onClick={()=>setRetry(value=>value+1)}>تلاش دوباره</button>}</div>}
    <div role="status" className="settings-save-status">{notice||(!features&&!error?'در حال دریافت تنظیمات…':'')}</div>
    {features&&<div className="section-switch-grid">{sections.map(section=><article key={section.key} className="section-switch-card"><div className="section-switch-heading"><span><Icon name={section.icon}/></span><div><h3>{sectionLabels[section.key]}</h3><small>{features[section.key]?'روشن برای کاربران':'خاموش برای کاربران'}</small></div><button type="button" role="switch" className="section-switch" aria-label={sectionLabels[section.key]} aria-checked={features[section.key]} disabled={Boolean(busy)} onClick={()=>void toggle(section.key)}><i/></button></div><p>{section.description}</p>{busy===section.key&&<small role="status">در حال ذخیره…</small>}{section.key==='search'&&features.search&&!features.library&&<small className="settings-dependency">منتظر روشن‌شدن کتابخانه</small>}</article>)}</div>}
  </section></AdminShell>;
}
