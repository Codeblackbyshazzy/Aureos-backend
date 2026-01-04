import crypto from 'crypto';

/**
 * Generates a cryptographically secure random string using base64url encoding.
 */
export function randomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Returns a SHA-256 hash in hex form.
 */
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Computes an HMAC-SHA256 signature (hex encoded).
 */
export function hmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function base64UrlEncodeJson(input: unknown): string {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
}

function base64UrlDecodeToString(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export interface JwtCreateOptions {
  issuer: string;
  audience?: string;
  expiresInSeconds: number;
}

/**
 * Creates an HS256 JWT.
 */
export function createJwtHS256<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  secret: string,
  options: JwtCreateOptions
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  } as const;

  const fullPayload: Record<string, unknown> = {
    ...payload,
    iss: options.issuer,
    iat: nowSeconds,
    exp: nowSeconds + options.expiresInSeconds,
  };

  if (options.audience) {
    fullPayload.aud = options.audience;
  }

  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson(fullPayload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

export interface JwtVerifyResult {
  payload: Record<string, unknown>;
}

/**
 * Verifies an HS256 JWT.
 */
export function verifyJwtHS256(token: string, secret: string): JwtVerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('Invalid token');
  }

  const payloadRaw = base64UrlDecodeToString(encodedPayload);
  const parsedPayload = JSON.parse(payloadRaw) as unknown;

  if (!parsedPayload || typeof parsedPayload !== 'object') {
    throw new Error('Invalid token');
  }

  const payload = parsedPayload as Record<string, unknown>;

  const exp = payload.exp;
  if (typeof exp !== 'number') {
    throw new Error('Invalid token');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp <= nowSeconds) {
    throw new Error('Token expired');
  }

  return { payload };
}

/**
 * Sleeps for the specified number of milliseconds.
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * Computes the OIDC PKCE S256 code challenge for a given verifier.
 */
export function pkceS256Challenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Attempts to extract a JWT payload without verifying its signature.
 * Used only as a best-effort for OIDC id_token claim extraction.
 */
export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid token');
  }

  const payloadRaw = base64UrlDecodeToString(parts[1]);
  const parsed = JSON.parse(payloadRaw) as unknown;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid token');
  }

  return parsed as Record<string, unknown>;
}
