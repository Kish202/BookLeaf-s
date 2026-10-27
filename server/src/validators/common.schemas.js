import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number({ error: 'id must be a number' }).int().positive('id must be a positive integer'),
});

export const bookIdParamSchema = z.object({
  id: z.string().trim().min(1).max(20),
});

/** Accepts `?status=open` or `?status=open,in_progress` and returns an array. */
export function csvEnum(values) {
  return z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values, { error: `Allowed values: ${values.join(', ')}` })).min(1));
}

export const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
