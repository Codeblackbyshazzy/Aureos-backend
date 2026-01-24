import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { incrementVoteCount, decrementVoteCount, getUserVoteStatus } from '@/lib/voting';
import { ErrorCodes } from '@/lib/errors';
import { applyRateLimit } from '@/lib/rate-limiter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { id: projectId, feedbackId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    
    const supabase = await createServerClient();

    // Check if feedback exists and belongs to project
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback_items')
      .select('id, project_id, vote_count')
      .eq('id', feedbackId)
      .eq('project_id', projectId)
      .single();

    if (feedbackError || !feedback) {
      throw new Error('Feedback not found');
    }

    // Check if user already voted
    const hasVoted = await getUserVoteStatus(feedbackId, user.id, supabase);
    if (hasVoted) {
      return NextResponse.json(
        { success: false, error: 'User already voted', code: ErrorCodes.ALREADY_VOTED },
        { status: 400 }
      );
    }

    // Insert vote
    const { error: voteError } = await supabase
      .from('feedback_votes')
      .insert({
        feedback_id: feedbackId,
        user_id: user.id
      });

    if (voteError) throw voteError;

    // Increment count
    await incrementVoteCount(feedbackId, supabase);

    // Broadcast via WebSocket
    try {
      const { wsManager, createFeedbackVotedMessage } = await import('@/lib/websocket');
      const message = createFeedbackVotedMessage(feedbackId, user.id, (feedback.vote_count || 0) + 1);
      wsManager.broadcastToProject(projectId, message);
    } catch (wsError) {
      console.error('Failed to broadcast vote:', wsError);
    }

    return NextResponse.json({
      success: true,
      feedback: { ...feedback, vote_count: (feedback.vote_count || 0) + 1 },
      userHasVoted: true
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
    await applyRateLimit(user.id, user.role);

    const supabase = await createServerClient();

    // Check if vote exists
    const { data: vote, error: voteError } = await supabase
      .from('feedback_votes')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', user.id)
      .single();

    if (voteError || !vote) {
      return NextResponse.json(
        { success: false, error: 'Vote not found', code: ErrorCodes.VOTE_NOT_FOUND },
        { status: 404 }
      );
    }

    // Delete vote
    const { error: deleteError } = await supabase
      .from('feedback_votes')
      .delete()
      .eq('id', vote.id);

    if (deleteError) throw deleteError;

    // Decrement count
    await decrementVoteCount(feedbackId, supabase);

    // Get updated feedback
    const { data: feedback } = await supabase
      .from('feedback_items')
      .select('*')
      .eq('id', feedbackId)
      .single();

    return NextResponse.json({
      success: true,
      feedback,
      userHasVoted: false
    });
  } catch (error) {
    return handleError(error);
  }
}
