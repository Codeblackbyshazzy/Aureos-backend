import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { getPollResults } from '@/lib/polls';
import { handleError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; pollId: string } }
) {
  try {
    const { projectId, pollId } = params;
    const user = await requireProjectAccess(request, projectId);

    const results = await getPollResults(pollId, user.id);

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    return handleError(error);
  }
}
