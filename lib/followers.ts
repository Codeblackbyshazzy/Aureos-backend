import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Increments the follower count for a feedback item
 */
export async function incrementFollowerCount(feedbackId: string, client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('increment', {
    table_name: 'feedback_items',
    row_id: feedbackId,
    column_name: 'follower_count',
    amount: 1
  });
  if (error) throw error;
}

/**
 * Decrements the follower count for a feedback item
 */
export async function decrementFollowerCount(feedbackId: string, client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('increment', {
    table_name: 'feedback_items',
    row_id: feedbackId,
    column_name: 'follower_count',
    amount: -1
  });
  if (error) throw error;
}

/**
 * Checks if a user is following a feedback item
 */
export async function getUserFollowStatus(feedbackId: string, userId: string, client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from('feedback_followers')
    .select('id')
    .eq('feedback_id', feedbackId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) return false;
  return !!data;
}
