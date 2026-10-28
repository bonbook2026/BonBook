import {useEffect,useState} from 'react';
import {LibraryPage} from '../types';
export function PageArtwork({page,bookTitle}:{page:LibraryPage;bookTitle:string}){
 const url=page.imageUrl||page.sourceImageUrl,[error,setError]=useState(false);useEffect(()=>setError(false),[url]);
 const inline=page.visualMode==='IMAGE'||page.visualMode==='BOTH'||((!page.visualMode||page.visualMode==='AUTO')&&(Boolean(page.imageUrl)||page.content.trim().length<250));
 if(!url||page.visualMode==='TEXT')return null;
 const picture=<figure className="book-page-artwork">{error?<p>تصویر هنوز آماده نشده است؛ فایل اصلی را از پایین صفحه باز کن.</p>:<img src={url} alt={`${bookTitle}، تصویر صفحهٔ ${page.number.toLocaleString('fa-IR')}`} onError={()=>setError(true)} loading="lazy"/>}<figcaption>تصویر اصلی صفحهٔ {page.number.toLocaleString('fa-IR')}</figcaption></figure>;
 return inline?picture:<details className="page-artwork-details"><summary>نمایش تصویر اصلی این صفحه</summary>{picture}</details>;
}
export function AdminPageArtwork({page,onChange,onUpload,disabled}:{page:Pick<LibraryPage,'imageUrl'|'sourceImageUrl'|'imageAssetId'|'visualMode'>;onChange:(data:Partial<LibraryPage>)=>void;onUpload:(file:File)=>void;disabled:boolean}){
 return <section className="admin-page-artwork"><div><h3>تصویر و ظاهر این صفحه</h3><p>صفحه‌های تصویری کتاب حفظ می‌شوند. برای عکس یا طرح جدا هم می‌توانی تصویر بارگذاری کنی.</p></div><label>شیوهٔ نمایش<select value={page.visualMode||'AUTO'} onChange={e=>onChange({visualMode:e.target.value as LibraryPage['visualMode']})}><option value="AUTO">خودکار؛ صفحهٔ تصویری با عکس اصلی</option><option value="TEXT">فقط متن</option><option value="IMAGE">فقط تصویر</option><option value="BOTH">تصویر و متن</option></select></label><label className="reader-button upload-label">انتخاب تصویر صفحه<input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={e=>{if(e.target.files?.[0])onUpload(e.target.files[0]);}}/></label>{(page.imageUrl||page.sourceImageUrl)&&<img src={page.imageUrl||page.sourceImageUrl||''} alt="پیش‌نمایش تصویر این صفحه" loading="lazy"/>}{page.imageAssetId&&<button type="button" className="danger-button" onClick={()=>onChange({imageAssetId:null,imageUrl:null})}>برداشتن تصویر بارگذاری‌شده</button>}<small>تنظیمات تصویر با «ذخیرهٔ صفحه» ثبت می‌شوند.</small></section>;
}
