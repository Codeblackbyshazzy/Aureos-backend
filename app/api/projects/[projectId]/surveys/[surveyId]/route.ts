import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { updateSurveySchema } from '@/lib/validation';
import { Survey, ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/surveys/[surveyId]
 * Get a specific survey with its questions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse<ApiResponse<Survey>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Fetch survey with questions
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select(`
        *,
        survey_questions (
          id,
          question_text,
          question_type,
          options,
          required,
          order_index,
          created_at
        )
      `)
      .eq('id', params.surveyId)
      .eq('project_id', params.projectId)
      .single();
    
    if (surveyError) {
      return handleError(surveyError);
    }
    
    if (!survey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Survey not found',
          code: 'SURVEY_NOT_FOUND'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: survey
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/projects/[projectId]/surveys/[surveyId]
 * Update a survey
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse<ApiResponse<Survey>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateSurveySchema.parse(body);
    
    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.settings !== undefined) updateData.settings = validatedData.settings;
    if (validatedData.closed_at !== undefined) updateData.closed_at = validatedData.closed_at;
    
    // Update survey
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .update(updateData)
      .eq('id', params.surveyId)
      .eq('project_id', params.projectId)
      .select()
      .single();
    
    if (surveyError) {
      return handleError(surveyError);
    }
    
    if (!survey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Survey not found',
          code: 'SURVEY_NOT_FOUND'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: survey
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/projects/[projectId]/surveys/[surveyId]
 * Delete a survey
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; surveyId: string } }
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Delete survey (cascade will handle questions and responses)
    const { error: deleteError } = await supabase
      .from('surveys')
      .delete()
      .eq('id', params.surveyId)
      .eq('project_id', params.projectId);
    
    if (deleteError) {
      return handleError(deleteError);
    }
    
    return NextResponse.json({
      success: true,
      data: { success: true }
    });
    
  } catch (error) {
    return handleError(error);
  }
}