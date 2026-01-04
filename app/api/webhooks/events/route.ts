import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, updateLastActive } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter';
import { triggerWebhookEventSchema } from '@/lib/validation-phase2';
import { triggerWebhookEvent } from '@/lib/webhooks';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const rateLimit = await applyRateLimit(user.id, user.role);

    const body = await req.json();
    const validated = triggerWebhookEventSchema.parse(body);

    const result = await triggerWebhookEvent({
      projectId: validated.projectId,
      event: validated.event,
      payload: validated.payload,
    });

    await updateLastActive(user.id);

    return NextResponse.json({ success: true, data: result }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    return handleError(error);
  }
}
