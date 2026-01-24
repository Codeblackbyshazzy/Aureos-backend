import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { getProjectPresence } from '@/lib/realtime';
import { handleError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    await requireProjectAccess(request, projectId);

    const presence = await getProjectPresence(projectId);

    return NextResponse.json({
      success: true,
      data: presence
    });
  } catch (error) {
    return handleError(error);
  }
}
