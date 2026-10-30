import {ReactNode,useState} from 'react';
import {Link,NavLink,useLocation} from 'react-router-dom';
import {Layout} from './Layout';
import {Icon} from './Icon';
import {useAuth} from '../hooks/useAuth';
import '../admin-workspace.css';
export const bookStatus:Record<string,string>={DRAFT:'پیش‌نویس',PUBLISHED:'منتشرشده',HIDDEN:'مخفی',ARCHIVED:'بایگانی',TRASH:'سطل زباله'};
const groups:{label:string;items:{to:string;label:string;icon:Parameters<typeof Icon>[0]['name'];owner?:boolean}[]}[]=[
 {label:'کتاب و محتوا',items:[{to:'/admin',label:'کتاب‌ها',icon:'book' as const},{to:'/admin/categories',label:'دسته‌بندی‌ها',icon:'orders' as const}]},
 {label:'ظاهر و بخش‌های سایت',items:[{to:'/admin/library-hero',label:'طراحی کتابخانه',icon:'sun' as const},{to:'/admin/sections',label:'فعال‌سازی بخش‌ها',icon:'shop' as const}]},
 {label:'حساب و امنیت',items:[{to:'/admin/access',label:'مدیران همکار',icon:'user' as const,owner:true},{to:'/admin/content-security',label:'امنیت محتوا',icon:'shield' as const,owner:true}]},
];
export function AdminShell({children}:{children:ReactNode}){
 const {user}=useAuth(),{pathname}=useLocation(),[menu,setMenu]=useState(false);
 const current=pathname.startsWith('/admin/books/')?'ویرایش کتاب':groups.flatMap(group=>group.items).find(item=>item.to===pathname)?.label||'کتاب‌ها';
 return <Layout wide className="admin-layout"><div className="admin-workspace">
  <aside className="admin-sidebar"><Link to="/admin" className="admin-workspace-brand"><Icon name="shield"/><span><strong>مدیریت بون‌بوک</strong><small>{user?.role==='OWNER'?'حساب مالک':'ادمین محتوا'}</small></span></Link>
   <button className="admin-mobile-menu" aria-expanded={menu} aria-controls="admin-navigation" onClick={()=>setMenu(value=>!value)}><span>{current}</span><span>{menu?'بستن منو':'منوی مدیریت'}<Icon name="chevron"/></span></button>
   <nav id="admin-navigation" className={menu?'admin-navigation is-open':'admin-navigation'} aria-label="منوی مدیریت">{groups.map(group=>{const items=group.items.filter(item=>!('owner' in item)||user?.role==='OWNER');return items.length>0&&<div className="admin-nav-group" key={group.label}><span>{group.label}</span>{items.map(item=><NavLink key={item.to} to={item.to} end={item.to==='/admin'&&!pathname.startsWith('/admin/books/')} className={({isActive})=>isActive?'active':''} onClick={()=>setMenu(false)}><Icon name={item.icon}/>{item.label}</NavLink>)}</div>;})}<Link className="admin-library-link" to="/library"><Icon name="arrow"/>مشاهدهٔ سایت</Link></nav>
  </aside>
  <div className="admin-workspace-content"><div className="admin-breadcrumb"><Link to="/admin">مدیریت</Link><span>/</span><span>{current}</span></div>{children}</div>
 </div></Layout>;
}
