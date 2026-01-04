import { z } from 'zod';
import { createJwtHS256, verifyJwtHS256 } from '@/lib/crypto-utils';

const internalTokenSchema = z.object({
  iss: z.string(),
  iat: z.number(),
  exp: z.number(),
  typ: z.enum(['sso']),
  sub: z.string().uuid(),
  sid: z.string().uuid(),
});

export type InternalAccessTokenPayload = z.infer<typeof internalTokenSchema>;

export interface CreateSsoAccessTokenParams {
  userId: string;
  sessionId: string;
  expiresInSeconds?: number;
}

/**
 * Creates an internal Aureos access token for an SSO session.
 */
export function createSsoAccessToken(params: CreateSsoAccessTokenParams): string {
  const secret = process.env.INTERNAL_AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('Missing INTERNAL_AUTH_JWT_SECRET');
  }

  return createJwtHS256(
    {
      typ: 'sso',
      sub: params.userId,
      sid: params.sessionId,
    },
    secret,
    {
      issuer: 'aureos',
      expiresInSeconds: params.expiresInSeconds ?? 60 * 60 * 24 * 7, // 7 days
    }
  );
}

/**
 * Verifies an internal Aureos access token.
 */
export function verifyInternalAccessToken(token: string): InternalAccessTokenPayload {
  const secret = process.env.INTERNAL_AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('Missing INTERNAL_AUTH_JWT_SECRET');
  }

  const { payload } = verifyJwtHS256(token, secret);
  return internalTokenSchema.parse(payload);
}
