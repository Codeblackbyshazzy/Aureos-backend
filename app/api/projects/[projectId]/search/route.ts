import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { performFullTextSearch, getSearchSuggestions } from '@/lib/search';
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          results: [],
          total: 0,
          page: 1,
          limit,
          totalPages: 0,
          facets: {
            sentiments: [],
            sourceTypes: [],
            dateRange: { min: '', max: '' }
          }
        }
      });
    }

    const searchResults = await performFullTextSearch({
      query,
      projectId,
      userId: user.userId,
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