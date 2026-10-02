import { Router } from 'express';
import { getBookInfo, getBooks } from '../controllers/bookController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/info', authMiddleware, getBookInfo);
router.get('/', authMiddleware, getBooks);

export default router;
