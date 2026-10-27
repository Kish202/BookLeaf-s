import { Router } from 'express';
import { z } from 'zod';
import * as bookController from '../controllers/book.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookIdParamSchema } from '../validators/common.schemas.js';

const router = Router();

const listQuerySchema = z.object({
  authorId: z.string().trim().max(20).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['live', 'production']).optional(),
  sort: z.enum(['newest', 'oldest', 'title', 'sales', 'pending']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  // Defaults high so callers that need every book (e.g. the ticket form) get them in one page.
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

router.use(authenticate);

// Authors only ever receive their own books; `authorId` is honoured for admins only.
router.get('/', validate({ query: listQuerySchema }), bookController.list);
router.get('/:id', validate({ params: bookIdParamSchema }), bookController.get);

export default router;
