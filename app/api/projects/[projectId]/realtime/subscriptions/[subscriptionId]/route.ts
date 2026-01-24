import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { unsubscribeFromEvents } from '@/lib/realtime';
import { handleError } from '@/lib/errors';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; subscriptionId: string } }
) {
  try {
    const { projectId, subscriptionId } = params;
    const user = await requireProjectAccess(request, projectId);

    await unsubscribeFromEvents(subscriptionId, user.id);

    return NextResponse.json({
      success: true,
      data: { message: 'Unsubscribed successfully' }
    });
  } catch (error) {
    return handleError(error);
  }
}
