export interface CoverSettings {
  coverLayout?: 'SINGLE'|'SPREAD'; coverFrontSide?: 'LEFT'|'RIGHT';
  coverSpineStart?: number; coverSpineEnd?: number;
}
export function coverRegions(book:CoverSettings){
  const start=Math.max(20,Math.min(80,book.coverSpineStart??48))/100;
  const end=Math.max(start,Math.min(80,book.coverSpineEnd??52)/100);
  const left={start:0,end:start},right={start:end,end:1};
  return {front:book.coverFrontSide==='RIGHT'?right:left,back:book.coverFrontSide==='RIGHT'?left:right,spine:{start,end}};
}
