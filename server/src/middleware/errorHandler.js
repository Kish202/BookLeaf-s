import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';
const PG_INVALID_TEXT = '22P02';

function toAppError(err) {
  if (err instanceof AppError) return err;

  if (err.type === 'entity.parse.failed') {
    return AppError.badRequest('Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  switch (err.code) {
    case PG_UNIQUE_VIOLATION:
      return AppError.conflict('A record with these details already exists');
    case PG_FOREIGN_KEY_VIOLATION:
      return AppError.badRequest('A referenced record does not exist');
    case PG_CHECK_VIOLATION:
    case PG_INVALID_TEXT:
      return AppError.badRequest('One or more values are invalid');
    default:
      return null;
  }
}

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const appError = toAppError(err);

  if (!appError) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our side. Please try again.',
        ...(config.isProduction ? {} : { debug: err.message }),
      },
    });
  }

  return res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  });
}
