import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { updateCustomMetricSchema } from '@/lib/validation';
import { CustomMetric, ApiResponse } from '@/types';

/**
 * PUT /api/projects/[projectId]/analytics/custom-metrics/[metricId]
 * Update a custom metric
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; metricId: string } }
): Promise<NextResponse<ApiResponse<CustomMetric>>> {
  try {
    const { user } = await requireAuth();
    const supabase = createServerClient();
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateCustomMetricSchema.parse(body);
    
    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.formula !== undefined) updateData.formula = validatedData.formula;
    if (validatedData.chart_type !== undefined) updateData.chart_type = validatedData.chart_type;
    if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active;
    
    // Update custom metric
    const { data: metric, error: metricError } = await supabase
      .from('custom_metrics')
      .update(updateData)
      .eq('id', params.metricId)
      .eq('project_id', params.projectId)
      .select()
      .single();
    
    if (metricError) {
      return handleError(metricError);
    }
    
    if (!metric) {
      return NextResponse.json(
        {
          success: false,
          error: 'Custom metric not found',
          code: 'METRIC_NOT_FOUND'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: metric
    });
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/projects/[projectId]/analytics/custom-metrics/[metricId]
 * Delete a custom metric
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; metricId: string } }
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  try {
    await requireAuth();
    
    const supabase = createServerClient();
    
    // Delete custom metric
    const { error: deleteError } = await supabase
      .from('custom_metrics')
      .delete()
      .eq('id', params.metricId)
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