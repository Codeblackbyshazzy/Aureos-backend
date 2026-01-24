import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';

/**
 * DELETE /api/projects/[projectId]/languages/[languageCode]
 * Remove a language from a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; languageCode: string } }
): Promise<NextResponse<import('@/types').ApiResponse<{ success: boolean }>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Check if this is the default language
    const { data: language } = await supabase
      .from('project_languages')
      .select('is_default')
      .eq('project_id', params.projectId)
      .eq('language_code', params.languageCode)
      .single();
    
    if (language?.is_default) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete the default language',
          code: 'CANNOT_DELETE_DEFAULT_LANGUAGE'
        },
        { status: 400 }
      );
    }
    
    // Delete language
    const { error: deleteError } = await supabase
      .from('project_languages')
      .delete()
      .eq('project_id', params.projectId)
      .eq('language_code', params.languageCode);
    
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