import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { id: projectId, feedbackId } = await params;
    const user = await requireAuth();
    await getProjectWithOwnership(projectId, user.id);
    
    const adminClient = createAdminClient();
    
    // Soft delete by setting deleted_at
    const { error } = await adminClient
      .from('feedback_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', feedbackId)
      .eq('project_id', projectId);
    
    if (error) {
      throw new Error('Failed to delete feedback item');
    }
    
    return NextResponse.json({
      success: true,
      data: { message: 'Feedback deleted successfully' },
    });
  } catch (error) {
    return handleError(error);
  }
}
