import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { Integration, ApiResponse } from '@/types';

/**
 * GET /api/projects/[projectId]/integrations/[integrationId]/config
 * Get configuration for a specific integration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; integrationId: string } }
): Promise<NextResponse<ApiResponse<Integration>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Fetch integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', params.integrationId)
      .eq('project_id', params.projectId)
      .single();
    
    if (integrationError) {
      return handleError(integrationError);
    }
    
    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Integration not found',
          code: 'INTEGRATION_NOT_FOUND'
        },
        { status: 404 }
      );
    }
    
    // Don't return credentials in the config response
    const { credentials, ...configData } = integration;
    
    return NextResponse.json({
      success: true,
      data: configData
    });
    
  } catch (error) {
    return handleError(error);
  }
}