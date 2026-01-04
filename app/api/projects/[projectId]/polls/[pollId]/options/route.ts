import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { addPollOptions, removePollOption } from '@/lib/polls';
import { handleError } from '@/lib/errors';
import { z } from 'zod';

const addOptionsSchema = z.object({
  options: z.array(z.string().min(1).max(500)).min(1).max(10)
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; pollId: string } }
) {
  try {
    const { projectId, pollId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = addOptionsSchema.parse(body);

    const result = await addPollOptions(pollId, validatedData.options, user.userId);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Options added successfully'
    });
  } catch (error) {
    return handleError(error);
  }
}