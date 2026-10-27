import { createApp } from './app.js';
import { config } from './config/env.js';
import { pool } from './db/pool.js';

const app = createApp();

// Express 5 passes listen errors (e.g. port in use) to this callback.
const server = app.listen(config.port, (err) => {
  if (err) {
    console.error(`Could not start server on port ${config.port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`BookLeaf API listening on http://localhost:${config.port} (${config.env})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
