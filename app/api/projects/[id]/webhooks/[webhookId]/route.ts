import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { updateWebhookSchema } from '@/lib/validation-phase2';
import { deleteWebhook, updateWebhook } from '@/lib/webhooks';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { id: projectId, webhookId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const body = await req.json();
    const validated = updateWebhookSchema.parse(body);

    const result = await updateWebhook({
      projectId,
      webhookId,
      userId: user.id,
      url: validated.url,
      isActive: validated.isActive,
      events: validated.events,
      rotateSecret: validated.rotateSecret,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: result }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { id: projectId, webhookId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    await deleteWebhook({ projectId, webhookId });

    await updateLastActive(user.id);

    return NextResponse.json(
      { success: true, data: { message: 'Webhook deleted successfully' } },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
