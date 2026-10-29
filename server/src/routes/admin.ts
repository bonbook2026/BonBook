import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin, requireOwner } from '../middleware/admin';
import { adminBooks, adminBook, savePage, adminAccess, changeBookState } from '../controllers/adminController';
import { categories } from '../controllers/categoryController';
import {bookContents,suggestContents} from '../controllers/contentsController';
import {audioOptions,audioBatches,getAudioBatch,uploadBatchAudio} from '../controllers/audioBatchController';
import {pageAlignment,changeAlignment,alignBook,bookAlignments} from '../controllers/speechController';
import {uploadDocument,importOptions,bookImports,getImport,importedPage,applyImport} from '../controllers/importController';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {config} from '../config';
import { uploadMedia } from '../controllers/mediaController';
import { HttpError } from '../lib/httpError';
import {siteFeatures} from '../controllers/siteFeaturesController';
import {libraryHero} from '../controllers/libraryHeroController';
import {contentSecurity,revokeContentSession} from '../controllers/contentSecurityController';
import {privateContentHeaders} from '../middleware/contentSecurity';
import {previewPageTexts,listPageTexts,getPageTexts,applyPageTexts,undoPageTexts,textFilterSettings,previewTextFilterCleanup} from '../controllers/textImportController';
const router = Router();
router.use(privateContentHeaders,authMiddleware, requireAdmin);
router.get('/content-security',requireOwner,contentSecurity);
router.post('/content-security/sessions/:sessionId/revoke',requireOwner,revokeContentSession);
router.get('/sections',siteFeatures);
router.put('/sections/:section',siteFeatures);
router.get('/library-hero',libraryHero);
router.put('/library-hero',libraryHero);
router.get('/books', adminBooks);
router.post('/books', adminBooks);
router.get('/books/:id', adminBook);
router.put('/books/:id', adminBook);
router.delete('/books/:id', adminBook);
router.post('/books/:id/state',changeBookState);
router.get('/books/:id/contents',bookContents);
router.put('/books/:id/contents',bookContents);
router.post('/books/:id/contents/suggest',suggestContents);
router.get('/books/:id/audio-options',audioOptions);
router.get('/books/:id/audio-batches',audioBatches);
router.post('/books/:id/audio-batches',audioBatches);
router.post('/books/:id/align-audio',alignBook);
router.get('/books/:id/alignments',bookAlignments);
router.post('/books/:id/alignments/apply-ready',bookAlignments);
router.get('/audio-batches/:batchId',getAudioBatch);
router.delete('/audio-batches/:batchId',getAudioBatch);
router.get('/books/:id/pages/:page/alignment',pageAlignment);
router.post('/books/:id/pages/:page/alignment',pageAlignment);
router.get('/alignments/:alignmentId',changeAlignment);
router.delete('/alignments/:alignmentId',changeAlignment);
router.post('/alignments/:alignmentId/apply',changeAlignment);
router.post('/media/audio-batches/:batchId/items/:itemId',(req,res,next)=>{
 if(Number(req.get('content-length'))>31*1024*1024){next(new HttpError(413,'حجم هر ویس باید حداکثر ۳۰ مگابایت باشد.'));return;}
 const directory=path.resolve(config.mediaDirectory,'../audio-incoming');fs.mkdirSync(directory,{recursive:true,mode:0o700});
 multer({storage:multer.diskStorage({destination:directory,filename:(_req,_file,done)=>done(null,crypto.randomUUID()+'.upload')}),limits:{fileSize:30*1024*1024,files:1,fields:0}}).single('file')(req,res,error=>{if(error){if(req.file)fs.unlink(req.file.path,()=>{});next(new HttpError(400,'بارگذاری انجام نشد؛ حداکثر حجم هر ویس ۳۰ مگابایت است.'));return;}next();});
},uploadBatchAudio);
router.get('/books/:id/pages/:page',savePage);
router.put('/books/:id/pages/:page', savePage);
router.delete('/books/:id/pages/:page', savePage);
router.get('/categories',categories);
router.post('/categories',categories);
router.put('/categories/:categoryId',categories);
router.delete('/categories/:categoryId',categories);
router.get('/imports/options',importOptions);
router.get('/books/:id/imports',bookImports);
router.get('/imports/:importId',getImport);
router.delete('/imports/:importId',getImport);
router.get('/imports/:importId/pages/:page',importedPage);
router.put('/imports/:importId/pages/:page',importedPage);
router.post('/imports/:importId/apply',applyImport);
router.get('/books/:id/text-imports',listPageTexts);
router.get('/books/:id/text-filters',textFilterSettings);
router.put('/books/:id/text-filters',textFilterSettings);
router.post('/books/:id/text-filters/preview',previewTextFilterCleanup);
router.get('/books/:id/text-imports/:textImportId',getPageTexts);
router.get('/books/:id/text-imports/:textImportId/pages/:sourcePage',getPageTexts);
router.post('/books/:id/text-imports/:textImportId/apply',applyPageTexts);
router.post('/books/:id/text-imports/:textImportId/undo',undoPageTexts);
// Large multipart bodies use the existing Nginx upload location; JSON routes stay at 1 MB.
router.post('/media/text-import/:id',(req,res,next)=>{
 if(Number(req.get('content-length'))>10*1024*1024){next(new HttpError(413,'مجموع متن‌های ورودی باید حداکثر ۸ مگابایت باشد.'));return;}
 const directory=path.resolve(config.mediaDirectory,'../text-incoming');fs.mkdirSync(directory,{recursive:true,mode:0o700});
 multer({storage:multer.diskStorage({destination:directory,filename:(_req,_file,done)=>done(null,crypto.randomUUID()+'.upload')}),limits:{fileSize:8*1024*1024,files:2000,fields:1,fieldSize:32,parts:2001}}).array('files',2000)(req,res,error=>{
  if(error){for(const file of (req.files||[]) as Express.Multer.File[])fs.unlink(file.path,()=>{});next(new HttpError(400,'بارگذاری متن انجام نشد؛ حداکثر ۲۰۰۰ فایل و مجموع ۸ مگابایت انتخاب کنید.'));return;}next();
 });
},previewPageTexts);
router.post('/media/import/:id',(req,res,next)=>{
  if(Number(req.get('content-length'))>31*1024*1024){next(new HttpError(413,'مجموع فایل‌ها باید حداکثر ۳۰ مگابایت باشد.'));return;}
  const directory=path.resolve(config.mediaDirectory,'../import-incoming');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  multer({storage:multer.diskStorage({destination:directory,filename:(_req,_file,done)=>done(null,crypto.randomUUID()+'.upload')}),limits:{fileSize:30*1024*1024,files:100,fields:2,fieldSize:1000}}).array('files',100)(req,res,error=>{
    if(error){for(const file of (req.files||[]) as Express.Multer.File[])fs.unlink(file.path,()=>{});next(new HttpError(400,'بارگذاری انجام نشد. مجموع فایل‌ها باید حداکثر ۳۰ مگابایت باشد.'));return;}next();
  });
},uploadDocument);
router.post('/media/:kind', (req, res, next) => {
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1, fields: 0 } }).single('file')(req, res, (error) => {
    if (error) { next(new HttpError(400, 'فایل بارگذاری نشد. حداکثر حجم صوت ۳۰ مگابایت است.')); return; }
    next();
  });
}, uploadMedia);
router.get('/access', requireOwner, adminAccess);
router.post('/access', requireOwner, adminAccess);
router.delete('/access/:grantId', requireOwner, adminAccess);
export default router;
