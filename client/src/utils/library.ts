export interface RecordedPageSummary{number:number;heading:string;hasAudio?:boolean}
export function chooseLibraryPreview(pages:RecordedPageSummary[],resumeNumber?:number){
  const recorded=pages.filter(page=>page.hasAudio&&Number.isSafeInteger(page.number)&&page.number>0).sort((a,b)=>a.number-b.number);
  return recorded.find(page=>page.number===resumeNumber)||recorded.find(page=>/پیشگفتار|پیش‌گفتار|مقدمه|مانیفست/.test(page.heading))||recorded[0]||null;
}
export function savedBookIds(value:string|null):number[]{
  try{const parsed:unknown=JSON.parse(value||'[]');if(!Array.isArray(parsed))return [];return [...new Set(parsed.filter((id):id is number=>typeof id==='number'&&Number.isSafeInteger(id)&&id>0))].slice(0,1000);}catch{return [];}
}
