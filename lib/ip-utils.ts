import { NextRequest } from 'next/server';

/**
 * Extracts the client IP address from a Next.js request.
 * Checks multiple headers in order of preference to handle different proxies.
 */
function getRawClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const ip = request.headers.get('x-client-ip');
  if (ip) {
    return ip;
  }

  return 'unknown';
}

/**
 * Hashes an IP address using SHA-256 for privacy.
 * Returns a hex-encoded string of the hash.
 */
async function hashIp(ip: string): Promise<string> {
  if (ip === 'unknown') {
    return 'unknown';
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Extracts and hashes the client IP from a request.
 * This prevents storing raw IPs in Redis while still providing rate limiting by IP.
 */
export async function getClientIp(request: NextRequest): Promise<string> {
  const rawIp = getRawClientIp(request);
  return await hashIp(rawIp);
}
