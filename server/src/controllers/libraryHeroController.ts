import {Request,Response,NextFunction} from 'express';
import {readLibraryHero,saveLibraryHero} from '../services/libraryHeroService';
import {contentIdentity,signedMediaUrl} from '../services/contentProtection';
import {HttpError} from '../lib/httpError';
export async function libraryHero(req:Request,res:Response,next:NextFunction){
  try{res.setHeader('Cache-Control','no-store');res.json({hero:req.method==='GET'?await readLibraryHero():await saveLibraryHero(req.body)});}catch(error){next(error);}
}
export async function libraryHeroAudio(req:Request,res:Response,next:NextFunction){try{
 const hero=await readLibraryHero();if(hero.audioMode!=='UPLOAD'||!hero.audioAssetId)throw new HttpError(404,'صدای معرفی انتخاب نشده است.');
 res.json({url:signedMediaUrl('/api/media/'+hero.audioAssetId,await contentIdentity(req),true)});
}catch(error){next(error);}}
