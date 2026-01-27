import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().min(20),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().min(1),
  STRIPE_PRICE_STARTER_YEARLY: z.string().min(1),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1),
  STRIPE_PRICE_PRO_YEARLY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // AI Services
  GEMINI_API_KEY: z.string().min(1),
  DEEPSEEK_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  AI_SERVICE_URL: z.string().url().optional(),
  AI_SERVICE_KEY: z.string().optional(),
  FEEDBACK_ANALYSIS_AI_PROVIDER: z.string().optional().default('gemini'),

  // Auth
  ADMIN_EMAILS: z.string().optional(),
  GUEST_JWT_SECRET: z.string().min(20).optional(),
  INTERNAL_AUTH_JWT_SECRET: z.string().min(20).optional(),

  // Redis
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Email
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional().default('hello@aureos.io'),

  // Rate Limiting
  RATE_LIMIT_FREE: z.coerce.number().default(10),
  RATE_LIMIT_STARTER: z.coerce.number().default(50),
  RATE_LIMIT_PRO: z.coerce.number().default(100),
  RATE_LIMIT_PUBLIC_FEEDBACK: z.coerce.number().default(20),
  RATE_LIMIT_ANALYZE_PER_USER: z.coerce.number().default(5),

  // Plan Limits
  PLAN_FREE_FEEDBACK_LIMIT: z.coerce.number().default(50),
  PLAN_STARTER_FEEDBACK_LIMIT: z.coerce.number().default(500),
  PLAN_PRO_FEEDBACK_LIMIT: z.coerce.number().default(10000),

  // Cost Rates
  GEMINI_INPUT_TOKEN_COST: z.coerce.number().default(0.000001),
  GEMINI_OUTPUT_TOKEN_COST: z.coerce.number().default(0.000002),
  DEEPSEEK_TOKEN_COST: z.coerce.number().default(0.0000005),
  FIRECRAWL_CREDIT_COST: z.coerce.number().default(0.01),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const { fieldErrors } = _env.error.flatten();
  const errorMessage = Object.entries(fieldErrors)
    .map(([field, errors]) => `  - ${field}: ${errors?.join(', ')}`)
    .join('\n');

  console.error(`❌ Invalid environment variables:\n${errorMessage}`);
  process.exit(1);
}

console.log('✅ Environment validation passed');

export const env = _env.data;
