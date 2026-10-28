import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin, requireOwner } from '../middleware/admin';
import { adminBooks, adminBook, savePage, adminAccess, changeBookState } from '../controllers/adminController';
import { categories } from '../controllers/categoryController';
import {uploadDocument,importOptions,bookImports,getImport,importedPage,applyImport} from '../controllers/importController';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {config} from '../config';
import { uploadMedia } from '../controllers/mediaController';
import { HttpError } from '../lib/httpError';
const router = Router();
router.use(authMiddleware, requireAdmin);
router.get('/books', adminBooks);
router.post('/books', adminBooks);
router.get('/books/:id', adminBook);
router.put('/books/:id', adminBook);
router.delete('/books/:id', adminBook);
router.post('/books/:id/state',changeBookState);
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
