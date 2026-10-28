import { useEffect, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { AdminGrant } from '../types';
export function AdminAccess(){
  const {user}=useAuth(),[grants,setGrants]=useState<AdminGrant[]>([]),[identifier,setIdentifier]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>api.admin.access().then(r=>setGrants(r.grants)).catch(e=>setError(e.message));useEffect(()=>{if(user?.role==='OWNER')void load();},[user?.role]);
  if(user?.role!=='OWNER')return <AdminShell><p className="notice error">فقط مالک می‌تواند ادمین کمکی تعیین کند.</p></AdminShell>;
  return <AdminShell><div className="admin-access-card"><h2>یک همکار به میز کار دعوت کن</h2><p>شناسهٔ عددی یا نام کاربری تلگرام، یا نشانی جیمیل همکارت را ثبت کن. دسترسی پس از ورود و تأیید هویت او فعال می‌شود.</p><form onSubmit={e=>{e.preventDefault();setBusy(true);setError('');void api.admin.addAdmin(identifier).then(()=>{setIdentifier('');return load();}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}><input aria-label="شناسه ادمین کمکی" dir="ltr" placeholder="@username / Telegram ID / name@gmail.com" required value={identifier} onChange={e=>setIdentifier(e.target.value)}/><button className="reader-button primary" disabled={busy}>افزودن ادمین</button></form><small>ادمین کمکی کتاب و محتوا را ویرایش می‌کند؛ مدیریت دسترسی‌ها با مالک است.</small></div>{error&&<p className="notice error" role="alert">{error}</p>}<div className="admin-grants">{grants.map(grant=><div key={grant.id}><strong dir="ltr">{grant.kind==='TELEGRAM_USERNAME'?'@':''}{grant.identifier}</strong><span>{grant.claimedUserId?'فعال':'در انتظار اولین ورود تأییدشده'}</span><button className="danger-button" onClick={()=>{if(window.confirm('دسترسی مدیریت این همکار برداشته شود؟'))void api.admin.removeAdmin(grant.id).then(load).catch(e=>setError(e.message));}}>لغو دسترسی</button></div>)}{!grants.length&&<p>هنوز ادمین کمکی ثبت نشده است.</p>}</div></AdminShell>;
}
