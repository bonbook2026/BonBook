export interface ReadingLine{start:number;end:number;text:string;paragraph:number}
export function readingLines(text:string):ReadingLine[]{
  const lines:ReadingLine[]=[];let paragraph=0;
  for(const block of text.matchAll(/[^\n]+|\n+/g)){
    if(block[0].startsWith('\n')){if(block[0].length>1)paragraph++;continue;}
    for(const sentence of block[0].matchAll(/[^.!?؟؛]+[.!?؟؛]*|[.!?؟؛]+/g)){
      let rest=sentence[0],offset=block.index!+sentence.index!;
      while(rest.length){let length=Math.min(160,rest.length);if(length<rest.length){const space=rest.lastIndexOf(' ',length);if(space>60)length=space+1;}
        const raw=rest.slice(0,length),leading=raw.length-raw.trimStart().length,value=raw.trim();
        if(value)lines.push({start:offset+leading,end:offset+leading+value.length,text:value,paragraph});offset+=length;rest=rest.slice(length);
      }
    }
  }
  return lines;
}
export function cueOffset(cues:{time:number;offset:number}[],time:number){let offset=-1;for(const cue of cues){if(cue.time>time)break;offset=cue.offset;}return offset;}
