import { createAdminClient } from '@/lib/supabase';
import { hmacSha256Hex, randomToken, sleep } from '@/lib/crypto-utils';

export interface WebhookRecord {
  id: string;
  project_id: string;
  url: string;
  secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookWithEvents extends Omit<WebhookRecord, 'secret'> {
  events: string[];
}

export interface WebhookDeliveryLogRecord {
  id: string;
  webhook_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  success: boolean;
  attempt: number;
  error_message: string | null;
  delivered_at: string | null;
  created_at: string;
}

async function ensureEventIds(eventNames: string[]): Promise<Map<string, string>> {
  const adminClient = createAdminClient();

  if (eventNames.length === 0) {
    return new Map();
  }

  // Upsert to ensure custom event names exist.
  await adminClient.from('webhook_events').upsert(eventNames.map(name => ({ name })), {
    onConflict: 'name',
    ignoreDuplicates: true,
  });

  const { data, error } = await adminClient
    .from('webhook_events')
    .select('id, name')
    .in('name', eventNames);

  if (error) {
    throw new Error('Failed to resolve webhook events');
  }

  const map = new Map<string, string>();
  (data ?? []).forEach(row => {
    map.set(row.name as string, row.id as string);
  });

  return map;
}

/**
 * Creates a webhook endpoint and subscribes it to events.
 */
export async function createWebhook(params: {
  projectId: string;
  userId: string;
  url: string;
  events: string[];
  isActive: boolean;
}): Promise<{ webhook: WebhookRecord; events: string[] }>
{
  const adminClient = createAdminClient();

  const secret = randomToken(32);

  const { data: webhook, error } = await adminClient
    .from('webhooks')
    .insert({
      project_id: params.projectId,
      url: params.url,
      secret,
      is_active: params.isActive,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select('*')
    .single();

  if (error || !webhook) {
    throw new Error('Failed to create webhook');
  }

  const eventIds = await ensureEventIds(params.events);

  const subscriptionRows = params.events
    .map(name => eventIds.get(name))
    .filter((id): id is string => typeof id === 'string')
    .map(eventId => ({ webhook_id: webhook.id as string, event_id: eventId }));

  if (subscriptionRows.length) {
    const { error: subError } = await adminClient.from('webhook_subscriptions').insert(subscriptionRows);
    if (subError) {
      throw new Error('Failed to create webhook subscriptions');
    }
  }

  return { webhook: webhook as WebhookRecord, events: params.events };
}

/**
 * Lists webhooks for a project.
 */
export async function listWebhooks(projectId: string): Promise<WebhookWithEvents[]> {
  const adminClient = createAdminClient();

  const { data: webhooks, error } = await adminClient
    .from('webhooks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to list webhooks');
  }

  const result: WebhookWithEvents[] = [];

  for (const webhook of webhooks ?? []) {
    const { data: subs } = await adminClient
      .from('webhook_subscriptions')
      .select('event:webhook_events(name)')
      .eq('webhook_id', webhook.id as string);

    const events = (subs ?? [])
      .map(s => (s.event as { name?: unknown } | null)?.name)
      .filter((name): name is string => typeof name === 'string');

    const { secret: _secret, ...rest } = webhook as WebhookRecord;
    result.push({ ...(rest as Omit<WebhookRecord, 'secret'>), events });
  }

  return result;
}

/**
 * Updates a webhook endpoint and its event subscriptions.
 */
export async function updateWebhook(params: {
  projectId: string;
  webhookId: string;
  userId: string;
  url?: string;
  isActive?: boolean;
  events?: string[];
  rotateSecret: boolean;
}): Promise<{ webhook: WebhookRecord; events: string[] }>
{
  const adminClient = createAdminClient();

  const update: Record<string, unknown> = {
    updated_by: params.userId,
  };

  if (params.url !== undefined) update.url = params.url;
  if (params.isActive !== undefined) update.is_active = params.isActive;
  if (params.rotateSecret) update.secret = randomToken(32);

  const { data: webhook, error } = await adminClient
    .from('webhooks')
    .update(update)
    .eq('project_id', params.projectId)
    .eq('id', params.webhookId)
    .select('*')
    .single();

  if (error || !webhook) {
    throw new Error('Failed to update webhook');
  }

  let eventNames: string[] = [];

  if (params.events) {
    const eventIds = await ensureEventIds(params.events);

    // Replace subscriptions
    await adminClient.from('webhook_subscriptions').delete().eq('webhook_id', params.webhookId);

    const subscriptionRows = params.events
      .map(name => eventIds.get(name))
      .filter((id): id is string => typeof id === 'string')
      .map(eventId => ({ webhook_id: params.webhookId, event_id: eventId }));

    if (subscriptionRows.length) {
      const { error: subError } = await adminClient.from('webhook_subscriptions').insert(subscriptionRows);
      if (subError) {
        throw new Error('Failed to update webhook subscriptions');
      }
    }

    eventNames = params.events;
  } else {
    const { data: subs } = await adminClient
      .from('webhook_subscriptions')
      .select('event:webhook_events(name)')
      .eq('webhook_id', params.webhookId);

    eventNames = (subs ?? [])
      .map(s => (s.event as { name?: unknown } | null)?.name)
      .filter((name): name is string => typeof name === 'string');
  }

  return { webhook: webhook as WebhookRecord, events: eventNames };
}

/**
 * Deletes a webhook endpoint.
 */
export async function deleteWebhook(params: { projectId: string; webhookId: string }): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('webhooks')
    .delete()
    .eq('project_id', params.projectId)
    .eq('id', params.webhookId);

  if (error) {
    throw new Error('Failed to delete webhook');
  }
}

function buildSignedHeaders(secret: string, timestamp: string, body: string): Record<string, string> {
  const signature = hmacSha256Hex(secret, `${timestamp}.${body}`);

  return {
    'Content-Type': 'application/json',
    'X-Aureos-Timestamp': timestamp,
    'X-Aureos-Signature': `sha256=${signature}`,
  };
}

async function deliverWebhookOnce(params: {
  webhook: WebhookRecord;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
}): Promise<{ ok: boolean; statusCode: number | null; error?: string }> {
  const adminClient = createAdminClient();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event: params.event,
    projectId: params.webhook.project_id,
    createdAt: new Date().toISOString(),
    data: params.payload,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(params.webhook.url, {
      method: 'POST',
      headers: buildSignedHeaders(params.webhook.secret, timestamp, body),
      body,
      signal: controller.signal,
    });

    const ok = res.ok;

    await adminClient.from('webhook_delivery_logs').insert({
      webhook_id: params.webhook.id,
      event_name: params.event,
      payload: params.payload,
      status_code: res.status,
      success: ok,
      attempt: params.attempt,
      delivered_at: new Date().toISOString(),
      error_message: ok ? null : `HTTP ${res.status}`,
    });

    return { ok, statusCode: res.status, error: ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook delivery failed';

    await adminClient.from('webhook_delivery_logs').insert({
      webhook_id: params.webhook.id,
      event_name: params.event,
      payload: params.payload,
      status_code: null,
      success: false,
      attempt: params.attempt,
      delivered_at: new Date().toISOString(),
      error_message: message,
    });

    return { ok: false, statusCode: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Delivers a webhook event with retries (exponential backoff, max 5 attempts).
 */
export async function deliverWebhookWithRetries(params: {
  webhook: WebhookRecord;
  event: string;
  payload: Record<string, unknown>;
}): Promise<void>
{
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await deliverWebhookOnce({
      webhook: params.webhook,
      event: params.event,
      payload: params.payload,
      attempt,
    });

    if (result.ok) {
      return;
    }

    if (attempt < maxAttempts) {
      const delayMs = Math.min(60_000, 1000 * 2 ** (attempt - 1));
      await sleep(delayMs);
    }
  }
}

/**
 * Triggers a webhook event for a project.
 */
export async function triggerWebhookEvent(params: {
  projectId: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<{ delivered: number }>
{
  const adminClient = createAdminClient();

  const { data: hooks, error } = await adminClient
    .from('webhooks')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('is_active', true);

  if (error) {
    throw new Error('Failed to fetch webhooks');
  }

  let delivered = 0;

  for (const hook of hooks ?? []) {
    const { data: subs } = await adminClient
      .from('webhook_subscriptions')
      .select('event:webhook_events(name)')
      .eq('webhook_id', hook.id as string);

    const events = (subs ?? [])
      .map(s => (s.event as { name?: unknown } | null)?.name)
      .filter((name): name is string => typeof name === 'string');

    if (!events.includes(params.event)) {
      continue;
    }

    await deliverWebhookWithRetries({ webhook: hook as WebhookRecord, event: params.event, payload: params.payload });
    delivered++;
  }

  return { delivered };
}

/**
 * Fetches delivery logs for a webhook.
 */
export async function listWebhookDeliveries(params: {
  webhookId: string;
  page: number;
  limit: number;
}): Promise<{ deliveries: WebhookDeliveryLogRecord[]; total: number }>
{
  const adminClient = createAdminClient();
  const offset = (params.page - 1) * params.limit;

  const { data, error, count } = await adminClient
    .from('webhook_delivery_logs')
    .select('*', { count: 'exact' })
    .eq('webhook_id', params.webhookId)
    .order('created_at', { ascending: false })
    .range(offset, offset + params.limit - 1);

  if (error) {
    throw new Error('Failed to fetch delivery logs');
  }

  return {
    deliveries: (data ?? []) as WebhookDeliveryLogRecord[],
    total: count ?? 0,
  };
}
