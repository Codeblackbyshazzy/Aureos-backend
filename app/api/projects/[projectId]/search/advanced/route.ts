import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { advancedSearch } from '@/lib/search';
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
    const sentiment = searchParams.get('sentiment')?.split(',') || [];
    const sourceType = searchParams.get('sourceType')?.split(',') || [];
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const minVotes = searchParams.get('minVotes') ? parseInt(searchParams.get('minVotes')!) : undefined;
    const hasComments = searchParams.get('hasComments') === 'true' ? true : 
                       searchParams.get('hasComments') === 'false' ? false : undefined;
    const hasVotes = searchParams.get('hasVotes') === 'true' ? true : 
                     searchParams.get('hasVotes') === 'false' ? false : undefined;
    const sortBy = (searchParams.get('sortBy') as 'relevance' | 'date' | 'votes' | 'comments') || 'relevance';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const searchResults = await advancedSearch(projectId, user.userId, {
      query,
      sentiment: sentiment.length > 0 ? sentiment : undefined,
      sourceType: sourceType.length > 0 ? sourceType : undefined,
      dateFrom,
      dateTo,
      minVotes,
      hasComments,
      hasVotes,
      sortBy,
      sortOrder,
      page,
      limit
    });

    return NextResponse.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    return handleError(error);
  }
}