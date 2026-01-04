import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { updateAnnouncementSchema } from '@/lib/validation-phase2';
import { deleteAnnouncement, getAnnouncement, recordAnnouncementRead, updateAnnouncement } from '@/lib/announcements';

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

    const announcement = await getAnnouncement({ projectId, announcementId });

    const isOwner = user.role === 'admin' || project.user_id === user.id;
    const rateLimit = isOwner
      ? await applyRateLimit(user.id, user.role, project.plan)
      : await applyRateLimit(user.id, user.role);

    if (!isOwner) {
      if (announcement.status !== 'published') {
        throw new Error('Forbidden: Announcement is not published');
      }

      const adminClient = createAdminClient();
      const { data: subscription } = await adminClient
        .from('announcement_subscribers')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .is('unsubscribed_at', null)
        .single();

      if (!subscription) {
        throw new Error('Forbidden: You are not subscribed to this project');
      }
    }

    await recordAnnouncementRead({ announcementId, userId: user.id });
    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: announcement }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
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

    const body = await req.json();
    const validated = updateAnnouncementSchema.parse(body);

    if (validated.status === 'scheduled' && !validated.scheduledFor) {
      throw new Error('scheduledFor is required for scheduled announcements');
    }

    const updated = await updateAnnouncement({
      projectId,
      announcementId,
      userId: user.id,
      title: validated.title,
      content: validated.content,
      categoryId: validated.categoryId,
      status: validated.status,
      scheduledFor: validated.scheduledFor ?? undefined,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: updated }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
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

    await deleteAnnouncement({ projectId, announcementId });

    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: { message: 'Announcement deleted successfully' } },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
