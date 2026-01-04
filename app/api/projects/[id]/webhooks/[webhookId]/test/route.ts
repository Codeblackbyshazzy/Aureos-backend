import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { deliverWebhookWithRetries, WebhookRecord } from '@/lib/webhooks';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { id: projectId, webhookId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const adminClient = createAdminClient();
    const { data: webhook, error } = await adminClient
      .from('webhooks')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', webhookId)
      .single();

    if (error || !webhook) {
      throw new Error('Webhook not found');
    }

    await deliverWebhookWithRetries({
      webhook: webhook as WebhookRecord,
      event: 'webhook.test',
      payload: { message: 'This is a test webhook event' },
    });

    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: { message: 'Test webhook sent' } },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
