import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { publishAnnouncement } from '@/lib/announcements';
import { triggerWebhookEvent } from '@/lib/webhooks';

async function getProject(projectId: string): Promise<{ id: string; user_id: string; plan: 'free' | 'starter' | 'pro' }> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('projects')
    .select('id, user_id, plan')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    throw new Error('Project not found');
  }

  return data as { id: string; user_id: string; plan: 'free' | 'starter' | 'pro' };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; announcementId: string }> }
) {
  try {
    const { id: projectId, announcementId } = await params;
    const user = await requireAuth();
    const project = await getProject(projectId);

    if (user.role !== 'admin' && project.user_id !== user.id) {
      throw new Error('Forbidden: You do not have access to this project');
    }

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const announcement = await publishAnnouncement({ projectId, announcementId, userId: user.id });

    await triggerWebhookEvent({
      projectId,
      event: 'announcement.published',
      payload: { announcementId: announcement.id, title: announcement.title },
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: announcement }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
