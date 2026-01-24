import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { subscribeToEvents } from '@/lib/realtime';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { RealtimeSubscribeRequest } from '@/types';

const subscribeSchema = z.object({
  event_types: z.array(z.string()),
  channel_name: z.string()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = subscribeSchema.parse(body) as RealtimeSubscribeRequest;

    const subscription = await subscribeToEvents(
      projectId,
      user.id,
      validatedData.event_types,
      validatedData.channel_name
    );

    return NextResponse.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    return handleError(error);
  }
}
