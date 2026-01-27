import { Plan, UserRole } from '@/types';
import { getUserPlan } from '@/lib/project-utils';
import { RateLimitError } from '@/lib/errors';
import { redis } from './redis';

interface RateLimitConfig {
  free: number;
  starter: number;
  pro: number;
}

const RATE_LIMITS: RateLimitConfig = {
  free: 10,
  starter: 50,
  pro: 100,
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
 * Uses Redis for distributed rate limiting across all serverless instances.
 */
export async function checkRateLimit(userId: string, plan: Plan): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const resetAt = windowStart + WINDOW_MS;
    const limit = RATE_LIMITS[plan];
    const key = `ratelimit:user:${userId}:${windowStart}`;

    const currentCount = await redis.get<number>(key) || 0;
    const allowed = currentCount < limit;

    if (allowed) {
      await redis.incr(key);
      await redis.expire(key, 90);
    }

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - (currentCount + (allowed ? 1 : 0))),
      resetAt,
    };
  } catch (error) {
    console.warn('Redis unavailable, allowing request (fail open):', error);
    return {
      allowed: true,
      limit: RATE_LIMITS.free,
      remaining: Number.MAX_SAFE_INTEGER,
      resetAt: Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS + WINDOW_MS,
    };
  }
}

/**
 * Rate limiting for unauthenticated endpoints (keyed by an arbitrary identifier, e.g. IP hash).
 * Uses Redis for distributed rate limiting across all serverless instances.
 */
export async function checkAnonymousRateLimit(identifier: string, limit: number): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
    const resetAt = windowStart + WINDOW_MS;
    const key = `ratelimit:ip:${identifier}:${windowStart}`;

    const currentCount = await redis.get<number>(key) || 0;
    const allowed = currentCount < limit;

    if (allowed) {
      await redis.incr(key);
      await redis.expire(key, 90);
    }

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - (currentCount + (allowed ? 1 : 0))),
      resetAt,
    };
  } catch (error) {
    console.warn('Redis unavailable, allowing request (fail open):', error);
    return {
      allowed: true,
      limit,
      remaining: Number.MAX_SAFE_INTEGER,
      resetAt: Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS + WINDOW_MS,
    };
  }
}

/**
 * Applies anonymous rate limiting and throws {@link RateLimitError} when exceeded.
 */
export async function applyAnonymousRateLimit(identifier: string, limit: number): Promise<RateLimitResult> {
  const result = await checkAnonymousRateLimit(identifier, limit);
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
  const result = await checkRateLimit(userId, resolvedPlan);

  if (!result.allowed) {
    throw new RateLimitError(result.resetAt);
  }

  return result;
}

/**
 * Generates rate limit headers from a RateLimitResult.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };

  const now = Date.now();
  const retryAfter = Math.max(0, Math.ceil((result.resetAt - now) / 1000));
  if (retryAfter > 0 && !result.allowed) {
    headers['Retry-After'] = retryAfter.toString();
  }

  return headers;
}

/**
 * Checks if Redis is available by attempting a ping.
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
