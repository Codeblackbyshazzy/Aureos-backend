import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { createAdminClient } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { id: projectId, feedbackId } = await params;
    const user = await requireAuth();
    await getProjectWithOwnership(projectId, user.id);
    
    const adminClient = createAdminClient();
    
    const { data: feedback, error } = await adminClient
      .from('feedback_items')
      .select(`
        *,
        status:feedback_statuses(*),
        topics:topics(*)
      `)
      .eq('id', feedbackId)
      .eq('project_id', projectId)
      .single();
    
    if (error || !feedback) {
      throw new Error('Feedback not found');
    }

    // Check user vote/follow
    const { data: vote } = await adminClient
      .from('feedback_votes')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: follow } = await adminClient
      .from('feedback_followers')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    return NextResponse.json({
      success: true,
      data: {
        ...feedback,
        user_has_voted: !!vote,
        user_is_following: !!follow
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

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
