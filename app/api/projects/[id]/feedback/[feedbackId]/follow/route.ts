import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { incrementFollowerCount, decrementFollowerCount, getUserFollowStatus } from '@/lib/followers';
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

    // Check if feedback exists
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback_items')
      .select('id, follower_count')
      .eq('id', feedbackId)
      .eq('project_id', projectId)
      .single();

    if (feedbackError || !feedback) {
      throw new Error('Feedback not found');
    }

    // Check if already following
    const isFollowing = await getUserFollowStatus(feedbackId, user.id, supabase);
    if (isFollowing) {
      return NextResponse.json(
        { success: false, error: 'Already following', code: ErrorCodes.ALREADY_FOLLOWING },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from('feedback_followers')
      .insert({
        feedback_id: feedbackId,
        user_id: user.id
      });

    if (insertError) throw insertError;

    await incrementFollowerCount(feedbackId, supabase);

    return NextResponse.json({
      success: true,
      isFollowing: true,
      followerCount: (feedback.follower_count || 0) + 1
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

    // Check if following
    const { data: follower, error: followerError } = await supabase
      .from('feedback_followers')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', user.id)
      .single();

    if (followerError || !follower) {
      return NextResponse.json(
        { success: false, error: 'Not following', code: ErrorCodes.NOT_FOLLOWING },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from('feedback_followers')
      .delete()
      .eq('id', follower.id);

    if (deleteError) throw deleteError;

    await decrementFollowerCount(feedbackId, supabase);

    const { data: feedback } = await supabase
      .from('feedback_items')
      .select('follower_count')
      .eq('id', feedbackId)
      .single();

    return NextResponse.json({
      success: true,
      isFollowing: false,
      followerCount: feedback?.follower_count || 0
    });
  } catch (error) {
    return handleError(error);
  }
}
