import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

/**
 * GET /api/public/widget/surveys/[projectId]/[surveyId]
 * Get a specific survey with questions (for widget)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse> {
  try {
    const supabase = createServerClient();
    
    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', params.projectId)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Get survey
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select(`
        id,
        title,
        description,
        status,
        is_nps,
        settings
      `)
      .eq('project_id', params.projectId)
      .eq('id', params.surveyId)
      .eq('status', 'active')
      .single();
    
    if (surveyError || !survey) {
      return NextResponse.json(
        { success: false, error: 'Survey not found' },
        { status: 404 }
      );
    }
    
    // Get survey questions
    const { data: questions, error: questionsError } = await supabase
      .from('survey_questions')
      .select(`
        id,
        question_text,
        question_type,
        options,
        required,
        order_index
      `)
      .eq('survey_id', params.surveyId)
      .order('order_index', { ascending: true });
    
    if (questionsError) {
      return handleError(questionsError);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...survey,
        questions: questions || []
      }
    });
    
  } catch (error) {
    return handleError(error);
  }
}