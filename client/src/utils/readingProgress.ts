export const DEVICE_HISTORY_KEY='bonbook_reading_history_v1';
export interface DeviceReadingProgress{bookId:number;pageNumber:number;title:string;heading:string;updatedAt:number}
interface ReadingStorage{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
export function deviceReadingHistory(storage?:ReadingStorage):DeviceReadingProgress[]{
  try{
    const parsed:unknown=JSON.parse((storage||localStorage).getItem(DEVICE_HISTORY_KEY)||'[]');
    if(!Array.isArray(parsed))return [];
    const valid=parsed.filter((entry):entry is DeviceReadingProgress=>Boolean(entry&&typeof entry==='object'&&positive(entry.bookId)&&positive(entry.pageNumber)&&typeof entry.updatedAt==='number'&&Number.isFinite(entry.updatedAt)&&entry.updatedAt>0&&typeof entry.title==='string'&&typeof entry.heading==='string'));
    return [...new Map(valid.sort((a,b)=>a.updatedAt-b.updatedAt).map(entry=>[entry.bookId,{...entry,title:entry.title.slice(0,300),heading:entry.heading.slice(0,300)}])).values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,100);
  }catch{return [];}
}
export function saveDeviceReading(entry:DeviceReadingProgress,storage?:ReadingStorage){
  if(!positive(entry.bookId)||!positive(entry.pageNumber)||!Number.isFinite(entry.updatedAt)||entry.updatedAt<=0)return false;
  try{
    const target=storage||localStorage;
    target.setItem(`bonbook_reading_${entry.bookId}`,String(entry.pageNumber));
    target.setItem(`bonbook_bookmark_${entry.bookId}`,String(entry.pageNumber));
    target.setItem(DEVICE_HISTORY_KEY,JSON.stringify([{...entry,title:entry.title.slice(0,300),heading:entry.heading.slice(0,300)},...deviceReadingHistory(target).filter(item=>item.bookId!==entry.bookId)].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,100)));
    if(typeof window!=='undefined')window.dispatchEvent(new Event('bonbook:reading-progress'));
    return true;
  }catch{return false;}
}
export function resumeDevicePage(bookId:number,pages:{number:number}[],storage?:ReadingStorage){
  try{
    const target=storage||localStorage,entry=deviceReadingHistory(target).find(item=>item.bookId===bookId);
    const candidates=[entry?.pageNumber,Number(target.getItem(`bonbook_reading_${bookId}`)),Number(target.getItem(`bonbook_bookmark_${bookId}`))];
    return candidates.find(number=>positive(number)&&pages.some(page=>page.number===number))||pages[0]?.number||null;
  }catch{return pages[0]?.number||null;}
}
export function deviceLibraryResume<T extends {id:number}>(books:T[],history:DeviceReadingProgress[]){
  for(const entry of [...history].sort((a,b)=>b.updatedAt-a.updatedAt)){const book=books.find(book=>book.id===entry.bookId);if(book)return {book,pageNumber:entry.pageNumber};}
  return null;
}
