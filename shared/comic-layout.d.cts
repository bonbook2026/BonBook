export function comicText(content:string,scene:{start:number;end:number;kind:string}):{narration:string;dialogue:string};
export function comicSheets<T>(scenes:T[]):T[][];
export function panelSpans(count:number):number[];
export function frameGeometry(total:number,index:number):{width:number;height:number;orientation:string;span:number};
