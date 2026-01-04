import { Plan } from '@/types';

// In-memory rate limiting store (for production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  free: number;
  starter: number;
  pro: number;
}

const RATE_LIMITS: RateLimitConfig = {
  free: parseInt(process.env.RATE_LIMIT_FREE || '10'),
  starter: parseInt(process.env.RATE_LIMIT_STARTER || '30'),
  pro: parseInt(process.env.RATE_LIMIT_PRO || '100'),
};

const WINDOW_MS = 60 * 1000; // 1 minute

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(userId: string, plan: Plan): RateLimitResult {
  const now = Date.now();
  const key = `${userId}:${Math.floor(now / WINDOW_MS)}`;
  const limit = RATE_LIMITS[plan];

  // Clean up old entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetAt < now) {
      rateLimitStore.delete(k);
    }
  }

  let record = rateLimitStore.get(key);

  if (!record) {
    record = {
      count: 0,
      resetAt: Math.floor(now / WINDOW_MS) * WINDOW_MS + WINDOW_MS,
    };
    rateLimitStore.set(key, record);
  }

  const allowed = record.count < limit;

  if (allowed) {
    record.count++;
  }

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.resetAt,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
}
