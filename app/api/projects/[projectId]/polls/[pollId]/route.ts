import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { getPollWithOptions, updatePoll, deletePoll } from '@/lib/polls';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { UpdatePollRequest } from '@/types';

const updatePollSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'closed', 'draft']).optional(),
  closed_at: z.string().datetime().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; pollId: string } }
) {
  try {
    const { projectId, pollId } = params;
    const user = await requireProjectAccess(request, projectId);

    const result = await getPollWithOptions(pollId, user.userId);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; pollId: string } }
) {
  try {
    const { projectId, pollId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = updatePollSchema.parse(body) as UpdatePollRequest;

    const result = await updatePoll(pollId, user.userId, validatedData);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; pollId: string } }
) {
  try {
    const { projectId, pollId } = params;
    const user = await requireProjectAccess(request, projectId);

    await deletePoll(pollId, user.userId);

    return NextResponse.json({
      success: true,
      data: { message: 'Poll deleted successfully' }
    });
  } catch (error) {
    return handleError(error);
  }
}