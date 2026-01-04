import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { announcementListQuerySchema, createAnnouncementSchema } from '@/lib/validation-phase2';
import { createAnnouncement, listAnnouncements } from '@/lib/announcements';

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

/**
 * POST /api/projects/[id]/announcements
 * Creates an announcement.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProject(projectId);

    if (user.role !== 'admin' && project.user_id !== user.id) {
      throw new Error('Forbidden: You do not have access to this project');
    }

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const body = await req.json();
    const validated = createAnnouncementSchema.parse(body);

    const status = validated.status ?? 'draft';

    if (status === 'scheduled' && !validated.scheduledFor) {
      throw new Error('scheduledFor is required for scheduled announcements');
    }

    const announcement = await createAnnouncement({
      projectId,
      userId: user.id,
      title: validated.title,
      content: validated.content,
      categoryId: validated.categoryId ?? null,
      status,
      scheduledFor: validated.scheduledFor ?? null,
    });

    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: announcement },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/projects/[id]/announcements
 * Lists announcements.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    const project = await getProject(projectId);

    const { searchParams } = new URL(req.url);
    const query = announcementListQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    });

    const isOwner = user.role === 'admin' || project.user_id === user.id;

    const rateLimit = isOwner
      ? await applyRateLimit(user.id, user.role, project.plan)
      : await applyRateLimit(user.id, user.role);

    if (!isOwner) {
      const adminClient = createAdminClient();
      const { data: subscription } = await adminClient
        .from('announcement_subscribers')
        .select('id, unsubscribed_at')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .is('unsubscribed_at', null)
        .single();

      if (!subscription) {
        throw new Error('Forbidden: You are not subscribed to this project');
      }
    }

    const list = await listAnnouncements({
      projectId,
      page: query.page,
      limit: query.limit,
      status: isOwner ? query.status : 'published',
      q: query.q,
    });

    await updateLastActive(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          data: list.announcements,
          total: list.total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(list.total / query.limit),
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
