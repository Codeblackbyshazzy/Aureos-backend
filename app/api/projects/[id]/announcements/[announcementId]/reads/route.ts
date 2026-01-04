import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { getAnnouncement, getAnnouncementReadStats } from '@/lib/announcements';

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

export async function GET(
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

    const announcement = await getAnnouncement({ projectId, announcementId });
    const stats = await getAnnouncementReadStats({ announcementId: announcement.id });

    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: { announcementId: announcement.id, ...stats } },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
