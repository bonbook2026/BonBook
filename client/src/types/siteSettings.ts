import defaults from '../../../server/src/config/library-hero.json';
export type SiteSection='library'|'search'|'store'|'profile';
export type SiteFeatures=Record<SiteSection,boolean>;
export const allSiteFeatures:SiteFeatures={library:true,search:true,store:true,profile:true};
export interface LibraryHeroSettings{
  kicker:string;titleLines:string[];intro:string;stories:string[][];
  searchVisible:boolean;searchPlaceholder:string;searchCaption:string;shelfLinkLabel:string;
  bookVisible:boolean;motionEnabled:boolean;coverBrand:string;coverEdition:string;coverTitle:string;coverSubtitle:string;coverFooter:string;backText:string;insideText:string;spineText:string;orbitCaption:string;
  frontImageAssetId:string|null;backImageAssetId:string|null;insideImageAssetId:string|null;
  audioMode:'AUTO'|'PAGE'|'UPLOAD'|'OFF';audioBookId:number|null;audioPageNumber:number|null;audioAssetId:string|null;audioTitle:string;audioCaption:string;
}
export const defaultLibraryHero=defaults as LibraryHeroSettings;
export const sectionLabels:Record<SiteSection,string>={library:'کتابخانه و کتاب‌خوان',search:'جست‌وجو',store:'فروشگاه',profile:'حساب کاربری'};
