import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { getSubscriptionStatus } from '@/lib/realtime';
import { handleError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const subscriptions = await getSubscriptionStatus(projectId, user.id);

    return NextResponse.json({
      success: true,
      data: {
        active_subscriptions: subscriptions,
        connection_status: 'active',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
