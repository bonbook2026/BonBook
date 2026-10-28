export type ContentsEntry={title:string;pageNumber:number;level:number};
export const asciiDigits=(text:string)=>text.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
// Suggestions are always reviewed by an administrator before being saved.
export function parseContents(text:string):ContentsEntry[]{
  const result:ContentsEntry[]=[];
  for(const raw of text.split(/\r?\n/)){
    const line=asciiDigits(raw).replace(/[\u200e\u200f\u202a-\u202e]/g,'').trim();
    const match=line.match(/^(.+?)\s*(?:\|\s*|[.·…ـ]{2,}\s*|\s+)([0-9]{1,5})\s*$/);
    if(!match)continue;
    const title=match[1].replace(/[.·…ـ\s]+$/g,'').replace(/^>+\s*/,'').trim(),pageNumber=Number(match[2]);
    if(title.length<2||title.length>200||!pageNumber||pageNumber>100000||!/[\p{L}]/u.test(title))continue;
    const level=Math.min(4,raw.trimStart().match(/^>+/)?.[0].length||(/^(?:بخش|گفتار|مبحث)\s/.test(title)?1:0));
    if(!result.some(item=>item.title===title&&item.pageNumber===pageNumber))result.push({title,pageNumber,level});
    if(result.length>=2000)break;
  }
  return result;
}
