import samples from '../../../shared/starter-library.json';
const books=samples.map((b,index)=>({id:index+1,...b,language:'fa-IR',status:'PUBLISHED',isSample:true,coverAssetId:null,coverUrl:null,updatedAt:'2026-10-28T00:00:00Z',pageCount:b.pages.length,pages:b.pages.map((p,i)=>({id:(index+1)*100+i,bookId:index+1,number:i+1,...p,audioAssetId:null,audioUrl:null,updatedAt:'2026-10-28T00:00:00Z'}))}));
const normalize=(s:string)=>s.toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ');
export function demoLibraryRequest(path:string,options:RequestInit):unknown{
  const url=new URL(path,'https://demo.invalid');
  if(url.pathname==='/library')return {books,categories:[...new Set(books.map(b=>b.category))]};
  if(url.pathname==='/library/progress')return options.method==='PUT'?{ok:true}:{progress:[]};
  if(url.pathname==='/library/search'){
    const query=url.searchParams.get('q')||'',scope=Number(url.searchParams.get('bookId'));
    const stop=new Set('از به در با برای و یا که را این من می خواهم پیدا کن کدام صفحه کتاب درباره توضیح میدهد می‌دهد فلان موضوع'.split(' '));
    const terms=normalize(query).split(/\s+/).filter(t=>t.length>1&&!stop.has(t));
    const results=books.filter(b=>!scope||b.id===scope).flatMap(book=>book.pages.map(page=>({...page,bookTitle:book.title,author:book.author,language:book.language,excerpt:page.content.slice(0,240),matchedTerms:terms.filter(t=>normalize(page.content+' '+page.heading+' '+page.keywords).includes(t))}))).filter(p=>p.matchedTerms.length).sort((a,b)=>b.matchedTerms.length-a.matchedTerms.length);
    return {query,results:results.slice(0,12)};
  }
  const match=url.pathname.match(/^\/library\/(\d+)(?:\/pages\/(\d+))?$/),book=books.find(b=>b.id===Number(match?.[1]));
  if(!book)throw new Error('کتاب پیدا نشد.');
  if(match?.[2]){const page=book.pages.find(p=>p.number===Number(match[2]));if(!page)throw new Error('صفحه پیدا نشد.');return {page};}
  return {book};
}
