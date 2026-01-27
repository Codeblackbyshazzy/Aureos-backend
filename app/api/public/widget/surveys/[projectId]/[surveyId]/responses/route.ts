import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { z } from 'zod';

/**
 * Rate limiting utility for widget endpoints
 */
class WidgetRateLimiter {
  private static readonly WIDGET_RATE_LIMIT = 5; // 5 submissions per minute
  private static readonly WIDGET_WINDOW_MS = 60 * 1000; // 1 minute
  
  static async checkRateLimit(
    supabase: any, 
    surveyId: string, 
    clientIP: string
  ): Promise<{ allowed: boolean; count: number; resetTime: string }> {
    const windowStart = new Date(Date.now() - this.WIDGET_WINDOW_MS).toISOString();
    
    try {
      const { data: recentResponses, error } = await supabase
        .from('survey_responses')
        .select('id', { count: 'exact' })
        .eq('survey_id', surveyId)
        .gte('submitted_at', windowStart);
      
      if (error) {
        console.error('Rate limit check error:', error);
        // Allow request if rate limit check fails
        return { allowed: true, count: 0, resetTime: new Date().toISOString() };
      }
      
      const count = recentResponses?.length || 0;
      const allowed = count < this.WIDGET_RATE_LIMIT;
      
      return {
        allowed,
        count,
        resetTime: new Date(Date.now() + this.WIDGET_WINDOW_MS).toISOString()
      };
      
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Allow request if rate limit check fails
      return { allowed: true, count: 0, resetTime: new Date().toISOString() };
    }
  }
  
  static getRemainingTime(resetTime: string): number {
    return Math.max(0, new Date(resetTime).getTime() - Date.now());
  }
}

/**
 * POST /api/public/widget/surveys/[projectId]/[surveyId]/responses
 * Submit a survey response via the embeddable widget (with rate limiting)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse> {
  try {
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    
    const responseSchema = z.object({
      answers: z.array(z.object({
        question_id: z.string().uuid('Invalid question ID'),
        answer_text: z.string().optional(),
        answer_value: z.any().optional()
      })).min(1, 'At least one answer required'),
      metadata: z.record(z.string(), z.any()).optional()
    });
    
    const validatedData = responseSchema.parse(body);
    
    // Get client IP
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown';
    
    // Check rate limiting
    const rateLimitResult = await WidgetRateLimiter.checkRateLimit(
      supabase, 
      params.surveyId, 
      clientIP
    );
    
    if (!rateLimitResult.allowed) {
      const remainingTime = WidgetRateLimiter.getRemainingTime(rateLimitResult.resetTime);
      const retryAfter = Math.ceil(remainingTime / 1000);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Rate limit exceeded. Maximum ${WidgetRateLimiter.WIDGET_RATE_LIMIT} submissions per minute.`,
          code: 'RATE_LIMITED',
          retryAfter,
          resetTime: rateLimitResult.resetTime
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': WidgetRateLimiter.WIDGET_RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(new Date(rateLimitResult.resetTime).getTime() / 1000).toString()
          }
        }
      );
    }
    
    // Verify survey exists and is active
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, status')
      .eq('project_id', params.projectId)
      .eq('id', params.surveyId)
      .eq('status', 'active')
      .single();
    
    if (surveyError || !survey) {
      return NextResponse.json(
        { success: false, error: 'Survey not found or not active' },
        { status: 404 }
      );
    }
    
    // Verify questions exist and match the survey
    const questionIds = validatedData.answers.map(a => a.question_id);
    const { data: questions, error: questionsError } = await supabase
      .from('survey_questions')
      .select('id')
      .eq('survey_id', params.surveyId)
      .in('id', questionIds);
    
    if (questionsError) {
      return handleError(questionsError);
    }
    
    const validQuestionIds = questions?.map(q => q.id) || [];
    const invalidQuestionIds = questionIds.filter(id => !validQuestionIds.includes(id));
    
    if (invalidQuestionIds.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid question IDs provided' },
        { status: 400 }
      );
    }
    
    // Create survey response
    const { data: response, error: responseError } = await supabase
      .from('survey_responses')
      .insert({
        survey_id: params.surveyId,
        respondent_id: null, // Widget responses are anonymous
        respondent_email: null,
        metadata: {
          ...validatedData.metadata,
          ip_address: clientIP,
          user_agent: request.headers.get('user-agent'),
          source: 'widget',
          submission_count: rateLimitResult.count + 1,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (responseError) {
      return handleError(responseError);
    }
    
    // Create survey answers
    const answersToInsert = validatedData.answers.map(answer => ({
      response_id: response.id,
      question_id: answer.question_id,
      answer_text: answer.answer_text || null,
      answer_value: answer.answer_value !== undefined ? answer.answer_value : (answer.answer_text || null)
    }));
    
    const { error: answersError } = await supabase
      .from('survey_answers')
      .insert(answersToInsert);
    
    if (answersError) {
      // Clean up the response if answers insertion fails
      await supabase.from('survey_responses').delete().eq('id', response.id);
      return handleError(answersError);
    }
    
    // Return success with rate limit headers
    return NextResponse.json({
      success: true,
      data: {
        id: response.id,
        message: 'Survey response submitted successfully'
      },
      rateLimit: {
        limit: WidgetRateLimiter.WIDGET_RATE_LIMIT,
        remaining: WidgetRateLimiter.WIDGET_RATE_LIMIT - (rateLimitResult.count + 1),
        resetTime: rateLimitResult.resetTime
      }
    }, {
      headers: {
        'X-RateLimit-Limit': WidgetRateLimiter.WIDGET_RATE_LIMIT.toString(),
        'X-RateLimit-Remaining': (WidgetRateLimiter.WIDGET_RATE_LIMIT - (rateLimitResult.count + 1)).toString(),
        'X-RateLimit-Reset': Math.ceil(new Date(rateLimitResult.resetTime).getTime() / 1000).toString()
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/public/widget/surveys/[projectId]/[surveyId]/responses
 * Get all responses for a survey (admin only, requires authentication)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse<ApiResponse<PaginatedResponse<SurveyResponseWithAnswers>>>> {
  try {
    // This endpoint requires authentication
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