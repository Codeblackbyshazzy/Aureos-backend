import { env } from './env';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { createJwtHS256, randomToken, sha256Hex, verifyJwtHS256 } from '@/lib/crypto-utils';

const guestTokenPayloadSchema = z.object({
  iss: z.string(),
  iat: z.number(),
  exp: z.number(),
  typ: z.literal('guest'),
  sid: z.string().uuid(),
  jti: z.string().min(8),
  permissions: z.array(z.string()).default([]),
});

export type GuestTokenPayload = z.infer<typeof guestTokenPayloadSchema>;

export interface GuestSessionRecord {
  id: string;
  project_id: string;
  created_by: string | null;
  permissions: string[];
  one_time: boolean;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function getGuestSecret(): string {
  const secret = env.GUEST_JWT_SECRET;
  if (!secret) {
    throw new Error('Missing GUEST_JWT_SECRET');
  }
  return secret;
}

/**
 * Creates a guest access token for a project.
 */
export async function createGuestAccessToken(params: {
  projectId: string;
  createdBy: string;
  permissions: string[];
  oneTime: boolean;
  expiresAtIso: string;
}): Promise<{ token: string; session: GuestSessionRecord }>
{
  const adminClient = createAdminClient();

  const { data: session, error } = await adminClient
    .from('guest_sessions')
    .insert({
      project_id: params.projectId,
      created_by: params.createdBy,
      permissions: params.permissions,
      one_time: params.oneTime,
      expires_at: params.expiresAtIso,
    })
    .select('*')
    .single();

  if (error || !session) {
    throw new Error('Failed to create guest session');
  }

  const expiresAtSeconds = Math.floor(new Date(params.expiresAtIso).getTime() / 1000);
  const nowSeconds = Math.floor(Date.now() / 1000);

  const expiresInSeconds = Math.max(60, expiresAtSeconds - nowSeconds);

  const token = createJwtHS256(
    {
      typ: 'guest',
      sid: session.id as string,
      jti: randomToken(16),
      permissions: params.permissions,
    },
    getGuestSecret(),
    {
      issuer: 'aureos',
      expiresInSeconds,
    }
  );

  const tokenHash = sha256Hex(token);

  const { error: tokenError } = await adminClient.from('guest_access_tokens').insert({
    session_id: session.id as string,
    token_hash: tokenHash,
  });

  if (tokenError) {
    throw new Error('Failed to persist guest token');
  }

  return { token, session: session as GuestSessionRecord };
}

/**
 * Lists active guest sessions for a project.
 */
export async function listGuestSessions(projectId: string): Promise<GuestSessionRecord[]> {
  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await adminClient
    .from('guest_sessions')
    .select('*')
    .eq('project_id', projectId)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to list guest sessions');
  }

  return (data ?? []) as GuestSessionRecord[];
}

/**
 * Revokes a guest session.
 */
export async function revokeGuestSession(params: {
  projectId: string;
  sessionId: string;
}): Promise<void>
{
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('guest_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('project_id', params.projectId)
    .eq('id', params.sessionId);

  if (error) {
    throw new Error('Failed to revoke guest session');
  }
}

/**
 * Verifies a guest token and marks it as used/active.
 */
export async function verifyGuestToken(token: string): Promise<{ session: GuestSessionRecord; payload: GuestTokenPayload }> {
  const adminClient = createAdminClient();

  const { payload } = verifyJwtHS256(token, getGuestSecret());
  const parsed = guestTokenPayloadSchema.parse(payload);

  const tokenHash = sha256Hex(token);

  const { data: tokenRow, error: tokenError } = await adminClient
    .from('guest_access_tokens')
    .select('id, session:guest_sessions(*)')
    .eq('token_hash', tokenHash)
    .single();

  if (tokenError || !tokenRow || !tokenRow.session) {
    throw new Error('Invalid guest token');
  }

  const session = tokenRow.session as GuestSessionRecord;

  if (session.revoked_at) {
    throw new Error('Guest token revoked');
  }

  const expiresAt = new Date(session.expires_at).getTime();
  if (expiresAt <= Date.now()) {
    throw new Error('Guest token expired');
  }

  if (session.one_time && session.used_at) {
    throw new Error('Guest token already used');
  }

  const nowIso = new Date().toISOString();

  await adminClient
    .from('guest_access_tokens')
    .update({ last_used_at: nowIso })
    .eq('id', tokenRow.id as string);

  if (session.one_time && !session.used_at) {
    await adminClient.from('guest_sessions').update({ used_at: nowIso }).eq('id', session.id);
  }

  return { session, payload: parsed };
}
