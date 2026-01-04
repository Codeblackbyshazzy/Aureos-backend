import { createServerClient, createAdminClient } from './supabase';
import { User, UserRole } from '@/types';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerClient();
  
  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  
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

export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

export async function requireAdmin() {
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
    
    await adminClient
      .from('users')
      .insert({
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
