import { NextRequest } from 'next/server';

/**
 * Best-effort client identifier for anonymous rate limiting.
 */
export function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return req.headers.get('x-real-ip') ?? 'unknown';
}
