import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized());
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      authorId: payload.authorId ?? null,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('Session expired, please log in again', 'TOKEN_EXPIRED'));
    }
    return next(AppError.unauthorized('Invalid authentication token', 'INVALID_TOKEN'));
  }
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden());
    }
    return next();
  };
}
