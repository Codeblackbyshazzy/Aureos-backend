import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/auth';
import { performFullTextSearch, getSearchSuggestions, advancedSearch } from '@/lib/search';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { SearchRequest } from '@/types';

const searchSchema = z.object({
  query: z.string(),
  filters: z.object({
    sentiment: z.array(z.string()).optional(),
    sourceType: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    hasComments: z.boolean().optional(),
    hasVotes: z.boolean().optional(),
    minVotes: z.number().optional()
  }).optional(),
  page: z.number().optional(),
  limit: z.number().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const user = await requireProjectAccess(request, projectId);

    const body = await request.json();
    const validatedData = searchSchema.parse(body) as SearchRequest;

    const results = await advancedSearch(projectId, user.id, {
      query: validatedData.query,
      sentiment: validatedData.filters?.sentiment as string[],
      sourceType: validatedData.filters?.sourceType as string[],
      dateFrom: validatedData.filters?.dateFrom,
      dateTo: validatedData.filters?.dateTo,
      minVotes: validatedData.filters?.minVotes,
      hasComments: validatedData.filters?.hasComments,
      hasVotes: validatedData.filters?.hasVotes,
      page: validatedData.page,
      limit: validatedData.limit
    });

    return NextResponse.json({
      success: true,
      data: results
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
      userId: user.id,
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