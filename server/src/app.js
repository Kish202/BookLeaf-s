import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  // In development Vite may pick another port (5174, ...) when 5173 is busy.
  const localhostOrigin = /^http:\/\/localhost:\d+$/;
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed =
          !origin || config.clientOrigins.includes(origin) || (!config.isProduction && localhostOrigin.test(origin));
        callback(null, allowed);
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  if (config.env !== 'test') {
    app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  }

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
