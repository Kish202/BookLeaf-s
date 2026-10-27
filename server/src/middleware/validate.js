import { AppError } from '../utils/AppError.js';

/**
 * Validates request parts against zod schemas, e.g. validate({ body: loginSchema }).
 * Parsed (trimmed, coerced) values are exposed on req.validated, because
 * Express 5 makes req.query read-only.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const details = [];

    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({
            location: part,
            field: issue.path.join('.') || null,
            message: issue.message,
          });
        }
      }
    }

    if (details.length > 0) {
      return next(AppError.validation(details));
    }

    req.validated = validated;
    return next();
  };
}
