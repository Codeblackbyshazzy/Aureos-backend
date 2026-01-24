import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { createSurveyQuestionSchema } from '@/lib/validation';
import { SurveyQuestion, ApiResponse } from '@/types';

/**
 * POST /api/projects/[projectId]/surveys/[surveyId]/questions
 * Create a new question for a survey
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse<ApiResponse<SurveyQuestion>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = createSurveyQuestionSchema.parse(body);
    
    // Get the next order index for questions in this survey
    const { data: maxOrderData } = await supabase
      .from('survey_questions')
      .select('order_index')
      .eq('survey_id', params.surveyId)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();
    
    const nextOrderIndex = validatedData.order_index || 
      (maxOrderData ? maxOrderData.order_index + 1 : 0);
    
    // Create survey question
    const { data: question, error: questionError } = await supabase
      .from('survey_questions')
      .insert({
        survey_id: params.surveyId,
        question_text: validatedData.question_text,
        question_type: validatedData.question_type,
        options: validatedData.options || [],
        required: validatedData.required || false,
        order_index: nextOrderIndex
      })
      .select()
      .single();
    
    if (questionError) {
      return handleError(questionError);
    }
    
    return NextResponse.json({
      success: true,
      data: question
    });
    
  } catch (error) {
    return handleError(error);
  }
}