import {Request,Response,NextFunction} from 'express';
import prisma from '../lib/prisma';
import {verifiedRateLimitAccount} from './rateLimiter';
import {readSiteFeatures,SiteSection} from '../services/siteFeaturesService';

export function requireSection(section:SiteSection){
  return async(req:Request,res:Response,next:NextFunction)=>{
    try{
      const features=await readSiteFeatures();
      if(features[section]&&(section!=='search'||features.library)){next();return;}
      const id=verifiedRateLimitAccount(req);
      const viewer=id?await prisma.user.findUnique({where:{id},select:{role:true}}):null;
      if(viewer&&['OWNER','ADMIN'].includes(viewer.role)){next();return;}
      res.setHeader('Cache-Control','no-store');
      res.status(403).json({error:'این بخش فعلاً توسط مدیریت غیرفعال شده است.',code:'SECTION_DISABLED',section});
    }catch(error){next(error);}
  };
}
