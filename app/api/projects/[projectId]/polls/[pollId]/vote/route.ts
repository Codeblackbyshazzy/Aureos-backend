import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { voteOnPoll } from '@/lib/polls';
import { handleError } from '@/lib/errors';
import { z } from 'zod';

const voteSchema = z.object({
  optionId: z.string().uuid()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; pollId: string } }
) {
  try {
    const { projectId, pollId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const { optionId } = voteSchema.parse(body);

    const vote = await voteOnPoll(pollId, optionId, user.id);

    return NextResponse.json({
      success: true,
      data: vote
    });
  } catch (error) {
    return handleError(error);
  }
}
