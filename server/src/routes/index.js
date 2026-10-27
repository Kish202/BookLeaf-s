import { Router } from 'express';
import { query } from '../db/pool.js';
import aiRoutes from './ai.routes.js';
import authRoutes from './auth.routes.js';
import bookRoutes from './books.routes.js';
import ticketRoutes from './tickets.routes.js';
import userRoutes from './users.routes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

router.use('/ai', aiRoutes);
router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/tickets', ticketRoutes);
router.use('/users', userRoutes);

export default router;
