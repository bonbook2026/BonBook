import {Request,Response,NextFunction} from 'express';
import {readSiteFeatures,setSiteFeature} from '../services/siteFeaturesService';
import {HttpError} from '../lib/httpError';

export async function siteFeatures(req:Request,res:Response,next:NextFunction){
  try{
    res.setHeader('Cache-Control','no-store');
    if(req.method==='GET'){res.json({features:await readSiteFeatures()});return;}
    if(!req.body||Object.keys(req.body).some(key=>key!=='enabled'))throw new HttpError(400,'فقط وضعیت روشن یا خاموش را ارسال کنید.');
    res.json({features:await setSiteFeature(String(req.params.section),req.body.enabled)});
  }catch(error){next(error);}
}
