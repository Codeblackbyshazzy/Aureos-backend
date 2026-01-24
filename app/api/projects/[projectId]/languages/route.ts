import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { addProjectLanguageSchema } from '@/lib/validation';
import { ProjectLanguage, ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/languages
 * Get all languages for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<ProjectLanguage[]>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Fetch project languages
    const { data: languages, error: languagesError } = await supabase
      .from('project_languages')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('language_name', { ascending: true });
    
    if (languagesError) {
      return handleError(languagesError);
    }
    
    return NextResponse.json({
      success: true,
      data: languages || []
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/projects/[projectId]/languages
 * Add a new language to a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<ProjectLanguage>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = addProjectLanguageSchema.parse(body);
    
    // If this is set as default, unset other defaults first
    if (validatedData.is_default) {
      await supabase
        .from('project_languages')
        .update({ is_default: false })
        .eq('project_id', params.projectId);
    }
    
    // Check if language already exists for this project
    const { data: existingLanguage } = await supabase
      .from('project_languages')
      .select('id')
      .eq('project_id', params.projectId)
      .eq('language_code', validatedData.language_code)
      .single();
    
    if (existingLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Language already exists for this project',
          code: 'LANGUAGE_EXISTS'
        },
        { status: 400 }
      );
    }
    
    // Create project language
    const { data: language, error: languageError } = await supabase
      .from('project_languages')
      .insert({
        project_id: params.projectId,
        language_code: validatedData.language_code,
        language_name: validatedData.language_name,
        is_default: validatedData.is_default || false,
        is_active: true
      })
      .select()
      .single();
    
    if (languageError) {
      return handleError(languageError);
    }
    
    return NextResponse.json({
      success: true,
      data: language
    });
    
  } catch (error) {
    return handleError(error);
  }
}