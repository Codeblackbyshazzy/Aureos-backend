import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { getSearchSuggestions } from '@/lib/search';
import { handleError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const suggestions = await getSearchSuggestions(projectId, query, user.id);

    return NextResponse.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    return handleError(error);
  }
}
