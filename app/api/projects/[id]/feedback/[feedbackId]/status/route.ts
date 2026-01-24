import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { feedbackStatusUpdateSchema } from '@/lib/validation-phase1';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { applyRateLimit } from '@/lib/rate-limiter';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { id: projectId, feedbackId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    await getProjectWithOwnership(projectId, user.id);

    const body = await req.json();
    const { statusId } = feedbackStatusUpdateSchema.parse(body);

    const supabase = await createServerClient();

    // Verify feedback exists
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback_items')
      .select('id')
      .eq('id', feedbackId)
      .eq('project_id', projectId)
      .single();

    if (feedbackError || !feedback) {
      throw new Error('Feedback not found');
    }

    // Verify status exists in same project
    const { data: status, error: statusError } = await supabase
      .from('feedback_statuses')
      .select('id')
      .eq('id', statusId)
      .eq('project_id', projectId)
      .single();

    if (statusError || !status) {
      return NextResponse.json(
        { success: false, error: 'Status not found in this project', code: ErrorCodes.STATUS_NOT_FOUND },
        { status: 404 }
      );
    }

    const { data: updatedFeedback, error: updateError } = await supabase
      .from('feedback_items')
      .update({ status_id: statusId })
      .eq('id', feedbackId)
      .select('*, status:feedback_statuses(*)')
      .single();

    if (updateError) throw updateError;

    // Broadcast via WebSocket
    try {
      const { wsManager, createStatusChangedMessage } = await import('@/lib/websocket');
      const message = createStatusChangedMessage(feedbackId, updatedFeedback.status, user.id);
      wsManager.broadcastToProject(projectId, message);
    } catch (wsError) {
      console.error('Failed to broadcast status change:', wsError);
    }

    return NextResponse.json({
      success: true,
      feedback: updatedFeedback
    });
  } catch (error) {
    return handleError(error);
  }
}
