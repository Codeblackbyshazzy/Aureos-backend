import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { updateRoadmapItemSchema } from '@/lib/validation';
import { handleError } from '@/lib/errors';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: projectId, itemId } = await params;
    const user = await requireAuth();
    await getProjectWithOwnership(projectId, user.id);
    
    const body = await req.json();
    const validated = updateRoadmapItemSchema.parse(body);
    
    const adminClient = createAdminClient();

    const updateData: Partial<{
      title: string;
      description: string | null;
      status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
      priority: 'low' | 'medium' | 'high' | 'critical';
      cluster_id: string | null;
    }> = {};

    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.priority !== undefined) updateData.priority = validated.priority;
    if (validated.clusterId !== undefined) updateData.cluster_id = validated.clusterId;

    const { data: item, error } = await adminClient
      .from('roadmap_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      throw new Error('Failed to update roadmap item');
    }
    
    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: projectId, itemId } = await params;
    const user = await requireAuth();
    await getProjectWithOwnership(projectId, user.id);
    
    const adminClient = createAdminClient();
    
    const { error } = await adminClient
      .from('roadmap_items')
      .delete()
      .eq('id', itemId)
      .eq('project_id', projectId);
    
    if (error) {
      throw new Error('Failed to delete roadmap item');
    }
    
    return NextResponse.json({
      success: true,
      data: { message: 'Roadmap item deleted successfully' },
    });
  } catch (error) {
    return handleError(error);
  }
}
