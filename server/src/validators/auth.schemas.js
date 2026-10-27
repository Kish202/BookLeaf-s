import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string({ error: 'Email is required' }).trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
});
