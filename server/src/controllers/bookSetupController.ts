import {Response,NextFunction} from 'express';
import {AuthRequest} from '../middleware/auth';
import prisma from '../lib/prisma';
import {HttpError} from '../lib/httpError';
import {positiveId} from './libraryController';
import {buildBookSetupProgress} from '../services/bookSetupProgress';

export async function bookSetupProgress(req:AuthRequest,res:Response,next:NextFunction){try{
 const id=positiveId(req.params.id);
 const book=await prisma.$transaction(tx=>tx.libraryBook.findUnique({where:{id},select:{title:true,author:true,category:true,status:true,coverAssetId:true,
  pages:{orderBy:{number:'asc'},select:{number:true,content:true,visualMode:true,audioAssetId:true,audioCues:true,audioCueMode:true,alignments:{orderBy:[{createdAt:'desc'},{id:'desc'}],take:1,select:{status:true,audioAssetId:true,contentHash:true}}}},
  contents:{select:{pageNumber:true}},imports:{orderBy:{createdAt:'desc'},take:1,select:{status:true,totalPages:true,completedPages:true}},
  audioBatches:{orderBy:{createdAt:'desc'},take:1,select:{status:true,items:{select:{status:true}}}},
 }}),{timeout:15000});
 if(!book||book.status==='TRASH')throw new HttpError(404,'کتاب در دسترس نیست.');
 res.json({progress:buildBookSetupProgress(book)});
}catch(error){next(error);}}
