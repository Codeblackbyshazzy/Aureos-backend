import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { paginationSchema } from '@/lib/validation';
import { IntegrationLog, ApiResponse, PaginatedResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/integrations/[integrationId]/logs
 * Get logs for a specific integration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; integrationId: string } }
): Promise<NextResponse<ApiResponse<PaginatedResponse<IntegrationLog>>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const eventType = url.searchParams.get('event_type');
    const success = url.searchParams.get('success');
    
    // Validate pagination parameters
    const paginationResult = paginationSchema.parse({ page, limit });
    
    // Calculate offset
    const offset = (paginationResult.page - 1) * paginationResult.limit;
    
    // Build query
    let query = supabase
      .from('integration_logs')
      .select('*', { count: 'exact' })
      .eq('integration_id', params.integrationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + paginationResult.limit - 1);
    
    // Apply filters
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    if (success !== null) {
      query = query.eq('success', success === 'true');
    }
    
    // Fetch integration logs
    const { data: logs, error: logsError, count } = await query;
    
    if (logsError) {
      return handleError(logsError);
    }
    
    const totalPages = Math.ceil((count || 0) / paginationResult.limit);
    
    return NextResponse.json({
      success: true,
      data: {
        data: logs || [],
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