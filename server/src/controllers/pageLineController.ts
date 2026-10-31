import {Request,Response,NextFunction} from 'express';
import prisma from '../lib/prisma';
import {positiveId} from './libraryController';
import {HttpError} from '../lib/httpError';
import {pageLineMap} from '../services/pageLineService';
export async function getPageLineMap(req:Request,res:Response,next:NextFunction){try{
 const page=await prisma.libraryPage.findFirst({where:{bookId:positiveId(req.params.id),number:positiveId(req.params.page),book:{status:'PUBLISHED'}},select:{updatedAt:true,book:{select:{language:true}},content:true,visualMode:true,audioAssetId:true,audioCues:true,audioCueMode:true,sourcePageNumber:true,audio:{select:{id:true,filename:true,mimeType:true}},image:{select:{id:true,filename:true,mimeType:true}},source:{select:{id:true,filename:true,mimeType:true}},alignments:{where:{status:'APPLIED'},orderBy:{createdAt:'desc'},take:1,select:{contentHash:true,audioAssetId:true,cues:true,words:true}}}});
 if(!page)throw new HttpError(404,'صفحه در دسترس نیست.');
 res.json({map:await pageLineMap({...page,language:page.book.language}),pageUpdatedAt:page.updatedAt.toISOString()});
}catch(error){next(error);}}
