export const audioFilename=(file:File)=>(file.webkitRelativePath||file.name);
export function audioPageNumber(filename:string):number|null{
 const name=filename.replace(/\\/g,'/').split('/').pop()!.replace(/\.[^.]+$/,'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
 const explicit=name.match(/(?:page|part|صفحه|پارت)[\s_.-]*(\d+)/i),groups=name.match(/\d+/g);
 const number=explicit?Number(explicit[1]):groups?.length===1?Number(groups[0]):0;return Number.isSafeInteger(number)&&number>0&&number<=100000?number:null;
}
