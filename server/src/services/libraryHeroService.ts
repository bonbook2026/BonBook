import defaults from '../config/library-hero.json';
import prisma from '../lib/prisma';
import {HttpError} from '../lib/httpError';

export type LibraryHeroConfig=Omit<typeof defaults,'frontImageAssetId'|'backImageAssetId'|'insideImageAssetId'|'audioAssetId'|'audioBookId'|'audioPageNumber'>&{frontImageAssetId:string|null;backImageAssetId:string|null;insideImageAssetId:string|null;audioAssetId:string|null;audioBookId:number|null;audioPageNumber:number|null};
const key='library_hero_v1';
const textLimits={kicker:160,intro:600,searchPlaceholder:160,searchCaption:160,shelfLinkLabel:80,coverBrand:40,coverEdition:60,coverTitle:120,coverSubtitle:100,coverFooter:120,backText:300,insideText:160,spineText:80,orbitCaption:120,audioTitle:100,audioCaption:160} as const;
const assetKeys=['frontImageAssetId','backImageAssetId','insideImageAssetId','audioAssetId'] as const;
function invalid():never{throw new HttpError(400,'تنظیمات بخش بالای کتابخانه معتبر نیست؛ متن‌ها و فایل‌های انتخاب‌شده را بررسی کنید.');}
function validate(value:unknown):LibraryHeroConfig{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(field=>!Object.prototype.hasOwnProperty.call(defaults,field)))invalid();
  const result={...defaults,...value} as LibraryHeroConfig;
  for(const [field,limit] of Object.entries(textLimits)){
    const text=result[field as keyof typeof textLimits];if(typeof text!=='string'||text.length>limit||text.includes('\u0000'))invalid();
    result[field as keyof typeof textLimits]=text.trim();
  }
  for(const field of ['searchVisible','bookVisible','motionEnabled'] as const)if(typeof result[field]!=='boolean')invalid();
  if(!Array.isArray(result.titleLines)||result.titleLines.length!==3||result.titleLines.some(line=>typeof line!=='string'||!line.trim()||line.length>80))invalid();
  if(!Array.isArray(result.stories)||result.stories.length<1||result.stories.length>8||result.stories.some(lines=>!Array.isArray(lines)||lines.length<1||lines.length>6||lines.some(line=>typeof line!=='string'||!line.trim()||line.length>200)))invalid();
  for(const field of assetKeys)if(result[field]!==null&&(typeof result[field]!=='string'||!/^[0-9a-f-]{36}$/.test(result[field]!)))invalid();
  for(const field of ['audioBookId','audioPageNumber'] as const)if(result[field]!==null&&(!Number.isSafeInteger(result[field])||result[field]!<1))invalid();
  if(!['AUTO','PAGE','UPLOAD','OFF'].includes(result.audioMode))invalid();
  if(result.audioMode==='UPLOAD'&&!result.audioAssetId)invalid();
  if(result.audioMode==='PAGE'&&(!result.audioBookId||!result.audioPageNumber))invalid();
  return result;
}
export async function readLibraryHero():Promise<LibraryHeroConfig>{
  const row=await prisma.siteSetting.findUnique({where:{key}});
  try{return validate(row?JSON.parse(row.value):defaults);}catch{return structuredClone(defaults);}
}
export async function saveLibraryHero(value:unknown){
  const hero=validate(value),ids=assetKeys.map(field=>hero[field]).filter((id):id is string=>Boolean(id));
  const assets=await prisma.mediaAsset.findMany({where:{id:{in:ids}},select:{id:true,kind:true}});
  for(const field of assetKeys){const id=hero[field];if(id&&!assets.some(asset=>asset.id===id&&(field==='audioAssetId'?asset.kind==='audio':['cover','page-image'].includes(asset.kind))))throw new HttpError(400,'فایل انتخاب‌شده موجود نیست یا نوع آن مناسب این بخش نیست.');}
  if(hero.audioMode==='PAGE'&&!await prisma.libraryPage.findFirst({where:{bookId:hero.audioBookId!,number:hero.audioPageNumber!,audioAssetId:{not:null},book:{status:'PUBLISHED'}}}))throw new HttpError(400,'برای صدا، صفحه‌ای از یک کتاب منتشرشده با ویس بارگذاری‌شده انتخاب کنید.');
  await prisma.siteSetting.upsert({where:{key},create:{key,value:JSON.stringify(hero)},update:{value:JSON.stringify(hero)}});
  return hero;
}
export async function isPublicHeroMedia(id:string){
  const hero=await readLibraryHero();
  return (hero.bookVisible&&[hero.frontImageAssetId,hero.backImageAssetId,hero.insideImageAssetId].includes(id))||(hero.audioMode==='UPLOAD'&&hero.audioAssetId===id);
}
