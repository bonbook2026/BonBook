import {Request,Response,NextFunction} from 'express';
import {readLibraryHero,saveLibraryHero} from '../services/libraryHeroService';
export async function libraryHero(req:Request,res:Response,next:NextFunction){
  try{res.setHeader('Cache-Control','no-store');res.json({hero:req.method==='GET'?await readLibraryHero():await saveLibraryHero(req.body)});}catch(error){next(error);}
}
