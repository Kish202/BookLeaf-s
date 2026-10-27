import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { subscribe } from '../realtime/events.js';

const router = Router();

// Proxies (Render, nginx) close idle connections; a comment line every 25s keeps it open.
const HEARTBEAT_MS = 25_000;

router.get('/', authenticate, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  res.write(`event: ready\ndata: {}\n\n`);

  const unsubscribe = subscribe(req.user, (event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
