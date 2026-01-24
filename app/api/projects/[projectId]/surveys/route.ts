import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { 
  createSurveySchema, 
  paginationSchema 
} from '@/lib/validation';
import { 
  CreateSurveyRequest, 
  Survey,
  ApiResponse,
  PaginatedResponse 
} from '@/types';

/**
 * GET /api/projects/[projectId]/surveys
 * Get all surveys for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<PaginatedResponse<Survey>>>> {
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
    
    // Fetch surveys with pagination
    const { data: surveys, error: surveysError, count } = await supabase
      .from('surveys')
      .select('*', { count: 'exact' })
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + paginationResult.limit - 1);
    
    if (surveysError) {
      return handleError(surveysError);
    }
    
    const totalPages = Math.ceil((count || 0) / paginationResult.limit);
    
    return NextResponse.json({
      success: true,
      data: {
        data: surveys || [],
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
 * POST /api/projects/[projectId]/surveys
 * Create a new survey
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<Survey>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = createSurveySchema.parse(body);
    
    const surveyData: CreateSurveyRequest = {
      ...validatedData,
      project_id: params.projectId,
      created_by: user.id
    };
    
    // Create survey
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .insert({
        project_id: surveyData.project_id,
        title: surveyData.title,
        description: surveyData.description || null,
        status: surveyData.status || 'draft',
        settings: surveyData.settings || {},
        created_by: surveyData.created_by
      })
      .select()
      .single();
    
    if (surveyError) {
      return handleError(surveyError);
    }
    
    return NextResponse.json({
      success: true,
      data: survey
    });
    
  } catch (error) {
    return handleError(error);
  }
}