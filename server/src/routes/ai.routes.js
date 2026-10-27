import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getUsageSummary } from '../services/ai.service.js';

const router = Router();

const usageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

router.get('/usage', authenticate, authorize('admin'), validate({ query: usageQuerySchema }), async (req, res) => {
  res.json({ data: await getUsageSummary(req.validated.query) });
});

export default router;
