import { createServerClient, createAdminClient } from './supabase';
import { RealtimeSubscription } from '../types';

export async function subscribeToEvents(
  projectId: string,
  userId: string,
  eventTypes: string[],
  channelName: string
): Promise<RealtimeSubscription> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('realtime_subscriptions')
    .insert({
      project_id: projectId,
      user_id: userId,
      event_types: eventTypes,
      channel_name: channelName
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSubscriptionStatus(projectId: string, userId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('realtime_subscriptions')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) throw error;
  return data;
}

export async function unsubscribeFromEvents(subscriptionId: string, userId: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('realtime_subscriptions')
    .delete()
    .eq('id', subscriptionId)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
}

export async function getProjectPresence(projectId: string) {
  // In a real production app, we might use Supabase Presence
  // Here we'll use our WebSocket manager's in-memory state
  const { wsManager } = await import('./websocket');
  return wsManager.getProjectPresence(projectId);
}
