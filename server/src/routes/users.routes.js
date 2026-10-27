import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { listAdmins } from '../services/user.service.js';

const router = Router();

router.get('/admins', authenticate, authorize('admin'), async (_req, res) => {
  res.json({ data: await listAdmins() });
});

export default router;
