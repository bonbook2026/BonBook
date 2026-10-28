import prisma from '../lib/prisma';
import {HttpError} from '../lib/httpError';

export const sectionKeys=['library','search','store','profile'] as const;
export type SiteSection=typeof sectionKeys[number];
export type SiteFeatures=Record<SiteSection,boolean>;
const prefix='section_enabled:';

export async function readSiteFeatures():Promise<SiteFeatures>{
  const rows=await prisma.siteSetting.findMany({where:{key:{in:sectionKeys.map(key=>prefix+key)}}});
  const settings=new Map(rows.map(row=>[row.key,row.value]));
  return Object.fromEntries(sectionKeys.map(key=>[key,settings.get(prefix+key)!=='false'])) as SiteFeatures;
}
export async function setSiteFeature(key:string,enabled:unknown){
  if(!sectionKeys.includes(key as SiteSection)||typeof enabled!=='boolean')throw new HttpError(400,'بخش و وضعیت روشن یا خاموش معتبر نیست.');
  // Each section has its own record, so simultaneous edits cannot overwrite other switches.
  await prisma.siteSetting.upsert({where:{key:prefix+key},create:{key:prefix+key,value:String(enabled)},update:{value:String(enabled)}});
  return readSiteFeatures();
}
