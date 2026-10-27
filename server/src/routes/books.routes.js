import { Router } from 'express';
import { z } from 'zod';
import * as bookController from '../controllers/book.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookIdParamSchema } from '../validators/common.schemas.js';

const router = Router();

const listQuerySchema = z.object({
  authorId: z.string().trim().max(20).optional(),
});

router.use(authenticate);

// Authors only ever receive their own books; `authorId` is honoured for admins only.
router.get('/', validate({ query: listQuerySchema }), bookController.list);
router.get('/:id', validate({ params: bookIdParamSchema }), bookController.get);

export default router;
