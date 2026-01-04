import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, updateLastActive } from '@/lib/auth';
import { getProjectWithAccess } from '@/lib/project-utils';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { webhookDeliveriesQuerySchema } from '@/lib/validation-phase2';
import { listWebhookDeliveries } from '@/lib/webhooks';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const { id: projectId, webhookId } = await params;
    const user = await requireAuth();
    const project = await getProjectWithAccess(projectId, { id: user.id, role: user.role });

    const rateLimit = await applyRateLimit(user.id, user.role, project.plan);

    const { searchParams } = new URL(req.url);
    const query = webhookDeliveriesQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    const deliveries = await listWebhookDeliveries({ webhookId, page: query.page, limit: query.limit });

    await updateLastActive(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          data: deliveries.deliveries,
          total: deliveries.total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(deliveries.total / query.limit),
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    return handleError(error);
  }
}
