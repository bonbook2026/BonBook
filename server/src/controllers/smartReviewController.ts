import {Response,NextFunction} from 'express';
import {AuthRequest} from '../middleware/auth';
import {positiveId} from './libraryController';
import {getSmartReview,startSmartReview,stopSmartReview,undoSmartReview} from '../services/smartAudioReview';
export async function smartAudioReview(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);
 if(req.method==='POST')await startSmartReview(bookId,req.userId!);
 if(req.method==='DELETE'){await getSmartReview(bookId);await stopSmartReview(bookId);}
 res.status(req.method==='POST'?202:200).json(await getSmartReview(bookId));
}catch(error){next(error);}}
export async function restoreAudioReview(req:AuthRequest,res:Response,next:NextFunction){try{
 const bookId=positiveId(req.params.id);await getSmartReview(bookId);
 res.json(await undoSmartReview(bookId,String(req.params.reviewId)));
}catch(error){next(error);}}
