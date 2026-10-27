import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: booleanString,
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  // Browsers send only scheme + host + port, so paths and trailing slashes are stripped.
  CLIENT_ORIGIN: z
    .string()
    .optional()
    .transform((value, ctx) =>
      (value || 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => {
          try {
            return new URL(origin).origin;
          } catch {
            ctx.addIssue({ code: 'custom', message: `"${origin}" is not a valid URL` });
            return z.NEVER;
          }
        }),
    ),
  SEED_AUTHOR_PASSWORD: z.string().min(6).default('Author@123'),
  SEED_ADMIN_PASSWORD: z.string().min(6).default('Admin@123'),
  // Optional: without a key the app runs on keyword classification and manual replies.
  GROQ_API_KEY: z.string().optional(),
  GROQ_CLASSIFY_MODEL: z.string().default('openai/gpt-oss-20b'),
  GROQ_DRAFT_MODEL: z.string().default('openai/gpt-oss-120b'),
  GROQ_FALLBACK_MODEL: z.string().default('qwen/qwen3.8-27b'),
  GROQ_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
}).refine((env) => env.NODE_ENV !== 'production' || process.env.CLIENT_ORIGIN, {
  message: 'CLIENT_ORIGIN is required in production (the deployed frontend URL)',
  path: ['CLIENT_ORIGIN'],
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  db: {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  clientOrigins: env.CLIENT_ORIGIN,
  seed: {
    authorPassword: env.SEED_AUTHOR_PASSWORD,
    adminPassword: env.SEED_ADMIN_PASSWORD,
  },
  ai: {
    apiKey: env.GROQ_API_KEY || null,
    classifyModel: env.GROQ_CLASSIFY_MODEL,
    draftModel: env.GROQ_DRAFT_MODEL,
    fallbackModel: env.GROQ_FALLBACK_MODEL,
    timeoutMs: env.GROQ_TIMEOUT_MS,
  },
};
