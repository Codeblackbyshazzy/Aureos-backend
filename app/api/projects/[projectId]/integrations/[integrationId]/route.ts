import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { updateIntegrationSchema } from '@/lib/validation';
import { Integration, ApiResponse } from '@/types';

/**
 * PUT /api/projects/[projectId]/integrations/[integrationId]
 * Update an integration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; integrationId: string } }
): Promise<NextResponse<ApiResponse<Integration>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateIntegrationSchema.parse(body);
    
    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.config !== undefined) updateData.config = validatedData.config;
    if (validatedData.credentials !== undefined) updateData.credentials = validatedData.credentials;
    if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active;
    
    // Update integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .update(updateData)
      .eq('id', params.integrationId)
      .eq('project_id', params.projectId)
      .select()
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
    
    return NextResponse.json({
      success: true,
      data: integration
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/projects/[projectId]/integrations/[integrationId]
 * Delete an integration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; integrationId: string } }
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Delete integration (cascade will handle logs)
    const { error: deleteError } = await supabase
      .from('integrations')
      .delete()
      .eq('id', params.integrationId)
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