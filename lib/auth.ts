import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { createAdminClient, createServerClient } from './supabase';
import { User, UserRole } from '@/types';
import { verifyInternalAccessToken } from '@/lib/internal-auth';

function getBearerToken(): string | null {
  const authHeader = headers().get('authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getUserFromInternalToken(token: string): Promise<User | null> {
  try {
    const parsed = verifyInternalAccessToken(token);
    const adminClient = createAdminClient();

    const { data: session, error: sessionError } = await adminClient
      .from('sso_sessions')
      .select('id, user_id, status, expires_at, revoked_at')
      .eq('id', parsed.sid)
      .single();

    if (sessionError || !session) {
      return null;
    }

    const expiresAt = new Date(session.expires_at).getTime();
    if (session.status !== 'active' || session.revoked_at || expiresAt <= Date.now()) {
      return null;
    }

    if (!session.user_id) {
      return null;
    }

    const { data: user, error: userError } = await adminClient
      .from('users')
      .select('*')
      .eq('id', session.user_id)
      .single();

    if (userError || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user.
 *
 * Supports:
 * - Supabase Auth cookies
 * - `Authorization: Bearer <supabase_access_token>`
 * - Internal SSO access tokens (`Authorization: Bearer <token>`)
 */
export async function getCurrentUser(): Promise<User | null> {
  const bearer = getBearerToken();

  if (bearer) {
    const internal = await getUserFromInternalToken(bearer);
    if (internal) {
      return internal;
    }
  }

  const supabase = await createServerClient();

  const { data: authData, error } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser();

  const authUser = authData.user;

  if (error || !authUser) {
    return null;
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  return user;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();

  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }

  return user;
}

export function isAdminEmail(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export async function ensureUserExists(authUserId: string, email: string): Promise<void> {
  const adminClient = createAdminClient();

  // Check if user exists
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('id', authUserId)
    .single();

  if (!existingUser) {
    // Create user with appropriate role
    const role: UserRole = isAdminEmail(email) ? 'admin' : 'user';

    await adminClient.from('users').insert({
      id: authUserId,
      email,
      role,
      created_at: new Date().toISOString(),
    });
  }
}

export async function updateLastActive(userId: string): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
}

/**
 * Returns authenticated user with project access verification.
 * Checks both authentication and project ownership/admin access.
 */
export async function requireProjectAccess(
  request: NextRequest,
  projectId: string
): Promise<User> {
  const user = await requireAuth();
  const adminClient = createAdminClient();

  const { data: project } = await adminClient
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  if (!project) {
    throw new Error('Project not found');
  }

  if (user.role !== 'admin' && project.user_id !== user.id) {
    throw new Error('Forbidden: You do not have access to this project');
  }

  return user;
}
