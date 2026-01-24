import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { configureIntegrationSchema } from '@/lib/validation';
import { Integration, ApiResponse } from '@/types';

/**
 * POST /api/projects/[projectId]/integrations/[integrationName]/configure
 * Configure a new integration for a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; integrationName: string } }
): Promise<NextResponse<ApiResponse<Integration>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = configureIntegrationSchema.parse(body);
    
    // Validate integration name
    const validProviders = ['slack', 'discord', 'github', 'zapier', 'mailchimp', 'intercom'];
    if (!validProviders.includes(params.integrationName)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid integration provider',
          code: 'INVALID_PROVIDER'
        },
        { status: 400 }
      );
    }
    
    // Check if integration already exists for this project
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('project_id', params.projectId)
      .eq('provider', params.integrationName)
      .single();
    
    if (existingIntegration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Integration already exists for this project',
          code: 'INTEGRATION_EXISTS'
        },
        { status: 400 }
      );
    }
    
    // Create integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .insert({
        project_id: params.projectId,
        provider: params.integrationName,
        name: validatedData.name,
        config: validatedData.config,
        credentials: validatedData.credentials,
        is_active: validatedData.is_active ?? true,
        created_by: user.id
      })
      .select()
      .single();
    
    if (integrationError) {
      return handleError(integrationError);
    }
    
    return NextResponse.json({
      success: true,
      data: integration
    });
    
  } catch (error) {
    return handleError(error);
  }
}