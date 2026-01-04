import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Increments a counter column for multiple records
 */
export async function incrementCounters(
  table: string,
  ids: string[],
  column: string,
  client: SupabaseClient
): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await client.rpc('increment_counters', {
    table_name: table,
    row_ids: ids,
    column_name: column,
    amount: 1
  });

  if (error) {
    // If RPC doesn't exist, fallback to single updates or handle error
    // For MVP, we'll assume we might need to add this RPC or use a simpler method
    for (const id of ids) {
      await client.rpc('increment', { table_name: table, row_id: id, column_name: column, amount: 1 });
    }
  }
}

/**
 * Decrements a counter column for multiple records
 */
export async function decrementCounters(
  table: string,
  ids: string[],
  column: string,
  client: SupabaseClient
): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await client.rpc('increment_counters', {
    table_name: table,
    row_ids: ids,
    column_name: column,
    amount: -1
  });

  if (error) {
    for (const id of ids) {
      await client.rpc('increment', { table_name: table, row_id: id, column_name: column, amount: -1 });
    }
  }
}

/**
 * Checks if a project exists
 */
export async function projectExists(projectId: string, client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();
  
  return !!data && !error;
}

/**
 * Checks if a feedback item exists
 */
export async function feedbackExists(feedbackId: string, client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from('feedback_items')
    .select('id')
    .eq('id', feedbackId)
    .single();
  
  return !!data && !error;
}
