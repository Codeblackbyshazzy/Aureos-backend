import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

/**
 * GET /api/public/widget/surveys/[projectId]
 * Get all active surveys for a project (for widget survey selection)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
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
    
    // Get active surveys
    const { data: surveys, error: surveysError } = await supabase
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
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (surveysError) {
      return handleError(surveysError);
    }
    
    return NextResponse.json({
      success: true,
      data: surveys || []
    });
    
  } catch (error) {
    return handleError(error);
  }
}