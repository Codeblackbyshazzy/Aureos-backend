import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { paginationSchema } from '@/lib/validation';
import { Integration, ApiResponse, PaginatedResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/integrations
 * Get all integrations for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<PaginatedResponse<Integration>>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    // Validate pagination parameters
    const paginationResult = paginationSchema.parse({ page, limit });
    
    // Calculate offset
    const offset = (paginationResult.page - 1) * paginationResult.limit;
    
    // Fetch integrations with pagination
    const { data: integrations, error: integrationsError, count } = await supabase
      .from('integrations')
      .select('*', { count: 'exact' })
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + paginationResult.limit - 1);
    
    if (integrationsError) {
      return handleError(integrationsError);
    }
    
    const totalPages = Math.ceil((count || 0) / paginationResult.limit);
    
    return NextResponse.json({
      success: true,
      data: {
        data: integrations || [],
        total: count || 0,
        page: paginationResult.page,
        limit: paginationResult.limit,
        totalPages
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}