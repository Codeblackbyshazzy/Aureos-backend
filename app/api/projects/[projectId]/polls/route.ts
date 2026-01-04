import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { createPoll, getPolls } from '@/lib/polls';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { CreatePollRequest } from '@/types';
import { checkPlanLimit } from '@/lib/project-utils';

const createPollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  options: z.array(z.string().min(1).max(500)).min(2).max(10),
  status: z.enum(['active', 'closed', 'draft']).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = createPollSchema.parse(body) as CreatePollRequest;

    // Check plan limits for polls
    const limitCheck = await checkPlanLimit(user.userId, 'polls');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: limitCheck.message },
        { status: 403 }
      );
    }

    const result = await createPoll(
      projectId,
      user.userId,
      validatedData.title,
      validatedData.description || null,
      validatedData.options,
      validatedData.status || 'active'
    );

    return NextResponse.json({
      success: true,
      data: {
        poll: result.poll,
        options: result.options
      }
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const polls = await getPolls(projectId, user.userId);

    return NextResponse.json({
      success: true,
      data: polls
    });
  } catch (error) {
    return handleError(error);
  }
}