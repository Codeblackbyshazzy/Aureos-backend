import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Increments the vote count for a feedback item
 */
export async function incrementVoteCount(feedbackId: string, client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('increment', {
    table_name: 'feedback_items',
    row_id: feedbackId,
    column_name: 'vote_count',
    amount: 1
  });
  if (error) throw error;
}

/**
 * Decrements the vote count for a feedback item
 */
export async function decrementVoteCount(feedbackId: string, client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('increment', {
    table_name: 'feedback_items',
    row_id: feedbackId,
    column_name: 'vote_count',
    amount: -1
  });
  if (error) throw error;
}

/**
 * Checks if a user has voted for a feedback item
 */
export async function getUserVoteStatus(feedbackId: string, userId: string, client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from('feedback_votes')
    .select('id')
    .eq('feedback_id', feedbackId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) return false;
  return !!data;
}

/**
 * Gets vote counts for multiple feedback items
 */
export async function getVoteCounts(feedbackIds: string[], client: SupabaseClient): Promise<Record<string, number>> {
  if (feedbackIds.length === 0) return {};

  const { data, error } = await client
    .from('feedback_items')
    .select('id, vote_count')
    .in('id', feedbackIds);

  if (error) throw error;

  return (data || []).reduce((acc, item) => {
    acc[item.id] = item.vote_count;
    return acc;
  }, {} as Record<string, number>);
}
