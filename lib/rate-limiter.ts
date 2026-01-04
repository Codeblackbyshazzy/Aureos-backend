import { Plan, UserRole } from '@/types';
import { getUserPlan } from '@/lib/project-utils';
import { RateLimitError } from '@/lib/errors';

// In-memory rate limiting store (for production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const anonymousRateLimitStore = new Map<string, { count: number; resetAt: number }>();

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

/**
 * Checks whether a request is allowed under the per-minute rate limit for a given user.
 */
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

/**
 * Rate limiting for unauthenticated endpoints (keyed by an arbitrary identifier, e.g. IP).
 */
export function checkAnonymousRateLimit(identifier: string, limit: number): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${Math.floor(now / WINDOW_MS)}`;

  for (const [k, v] of anonymousRateLimitStore.entries()) {
    if (v.resetAt < now) {
      anonymousRateLimitStore.delete(k);
    }
  }

  let record = anonymousRateLimitStore.get(key);

  if (!record) {
    record = {
      count: 0,
      resetAt: Math.floor(now / WINDOW_MS) * WINDOW_MS + WINDOW_MS,
    };
    anonymousRateLimitStore.set(key, record);
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

/**
 * Applies anonymous rate limiting and throws {@link RateLimitError} when exceeded.
 */
export function applyAnonymousRateLimit(identifier: string, limit: number): RateLimitResult {
  const result = checkAnonymousRateLimit(identifier, limit);
  if (!result.allowed) {
    throw new RateLimitError(result.resetAt);
  }
  return result;
}

/**
 * Applies rate limiting for a user.
 *
 * - Admins are not rate-limited.
 * - If `plan` is omitted, it will be derived from the user's active subscription (or project plan fallback).
 *
 * Throws a {@link RateLimitError} when the limit is exceeded.
 */
export async function applyRateLimit(
  userId: string,
  role: UserRole,
  plan?: Plan
): Promise<RateLimitResult> {
  if (role === 'admin') {
    const now = Date.now();
    return {
      allowed: true,
      limit: Number.MAX_SAFE_INTEGER,
      remaining: Number.MAX_SAFE_INTEGER,
      resetAt: Math.floor(now / WINDOW_MS) * WINDOW_MS + WINDOW_MS,
    };
  }

  const resolvedPlan = plan ?? (await getUserPlan(userId));
  const result = checkRateLimit(userId, resolvedPlan);

  if (!result.allowed) {
    throw new RateLimitError(result.resetAt);
  }

  return result;
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
}
