import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin, requireOwner } from '../middleware/admin';
import { adminBooks, adminBook, savePage, adminAccess } from '../controllers/adminController';
import { uploadMedia } from '../controllers/mediaController';
import { HttpError } from '../lib/httpError';
const router = Router();
router.use(authMiddleware, requireAdmin);
router.get('/books', adminBooks);
router.post('/books', adminBooks);
router.get('/books/:id', adminBook);
router.put('/books/:id', adminBook);
router.delete('/books/:id', adminBook);
router.put('/books/:id/pages/:page', savePage);
router.delete('/books/:id/pages/:page', savePage);
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
