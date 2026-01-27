import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { paginationSchema } from '@/lib/validation';
import { 
  SurveyResponse, 
  SurveyAnswer,
  ApiResponse,
  PaginatedResponse 
} from '@/types';

// Extend SurveyResponse to include answers for this endpoint
interface SurveyResponseWithAnswers extends SurveyResponse {
  answers: SurveyAnswer[];
}

/**
 * GET /api/projects/[projectId]/surveys/[surveyId]/responses
 * Get all responses for a survey (authenticated users only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse<ApiResponse<PaginatedResponse<SurveyResponseWithAnswers>>>> {
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
    
    // Fetch survey responses with pagination
    const { data: responses, error: responsesError, count } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact' })
      .eq('survey_id', params.surveyId)
      .order('submitted_at', { ascending: false })
      .range(offset, offset + paginationResult.limit - 1);
    
    if (responsesError) {
      return handleError(responsesError);
    }
    
    // Fetch answers for each response
    if (responses && responses.length > 0) {
      const responseIds = responses.map(r => r.id);
      
      const { data: answers } = await supabase
        .from('survey_answers')
        .select('*')
        .in('response_id', responseIds)
        .order('created_at', { ascending: true });
      
      // Group answers by response_id
      const answersByResponse: Record<string, SurveyAnswer[]> = {};
      if (answers) {
        answers.forEach(answer => {
          if (!answersByResponse[answer.response_id]) {
            answersByResponse[answer.response_id] = [];
          }
          answersByResponse[answer.response_id].push(answer);
        });
      }
      
      // Add answers to responses
      responses.forEach(response => {
        (response as SurveyResponseWithAnswers).answers = answersByResponse[response.id] || [];
      });
    }
    
    const totalPages = Math.ceil((count || 0) / paginationResult.limit);
    
    return NextResponse.json({
      success: true,
      data: {
        data: (responses as SurveyResponseWithAnswers[]) || [],
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