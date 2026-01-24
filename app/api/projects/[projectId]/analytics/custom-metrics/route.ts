import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { 
  createCustomMetricSchema, 
  updateCustomMetricSchema, 
  paginationSchema 
} from '@/lib/validation';
import { 
  CustomMetric, 
  ApiResponse, 
  PaginatedResponse 
} from '@/types';

/**
 * GET /api/projects/[projectId]/analytics/custom-metrics
 * Get all custom metrics for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<PaginatedResponse<CustomMetric>>>> {
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
    
    // Fetch custom metrics with pagination
    const { data: metrics, error: metricsError, count } = await supabase
      .from('custom_metrics')
      .select('*', { count: 'exact' })
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + paginationResult.limit - 1);
    
    if (metricsError) {
      return handleError(metricsError);
    }
    
    const totalPages = Math.ceil((count || 0) / paginationResult.limit);
    
    return NextResponse.json({
      success: true,
      data: {
        data: metrics || [],
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

/**
 * POST /api/projects/[projectId]/analytics/custom-metrics
 * Create a new custom metric
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<CustomMetric>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = createCustomMetricSchema.parse(body);
    
    // Create custom metric
    const { data: metric, error: metricError } = await supabase
      .from('custom_metrics')
      .insert({
        project_id: params.projectId,
        name: validatedData.name,
        description: validatedData.description || null,
        formula: validatedData.formula,
        chart_type: validatedData.chart_type || 'line',
        created_by: user.id
      })
      .select()
      .single();
    
    if (metricError) {
      return handleError(metricError);
    }
    
    return NextResponse.json({
      success: true,
      data: metric
    });
    
  } catch (error) {
    return handleError(error);
  }
}