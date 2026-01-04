import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { commentSchema } from '@/lib/validation-phase1';
import { buildCommentThread, incrementCommentCount } from '@/lib/comments';
import { applyRateLimit } from '@/lib/rate-limiter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { id: projectId, feedbackId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    const body = await req.json();
    const validated = commentSchema.parse(body);

    const supabase = await createServerClient();

    // Check if feedback exists
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback_items')
      .select('id')
      .eq('id', feedbackId)
      .eq('project_id', projectId)
      .single();

    if (feedbackError || !feedback) {
      throw new Error('Feedback not found');
    }

    // If parentCommentId provided, check if it exists and belongs to same feedback
    if (validated.parentCommentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id, feedback_id')
        .eq('id', validated.parentCommentId)
        .single();

      if (parentError || !parentComment || parentComment.feedback_id !== feedbackId) {
        throw new Error('Parent comment not found or invalid');
      }
    }

    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert({
        feedback_id: feedbackId,
        project_id: projectId,
        user_id: user.id,
        text: validated.text,
        parent_comment_id: validated.parentCommentId || null
      })
      .select('*, user:users(id, email)')
      .single();

    if (commentError) throw commentError;

    // Increment count
    await incrementCommentCount(feedbackId, supabase);

    return NextResponse.json({
      success: true,
      comment: { ...comment, replies: [] }
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { feedbackId } = await params;
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sort = searchParams.get('sort') || 'newest';
    const offset = (page - 1) * limit;

    const supabase = await createServerClient();

    // Fetch top-level comments for pagination
    let query = supabase
      .from('comments')
      .select('id', { count: 'exact' })
      .eq('feedback_id', feedbackId)
      .is('parent_comment_id', null)
      .is('deleted_at', null);

    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: true });
    }

    const { data: topLevelIds, count, error: countError } = await query.range(offset, offset + limit - 1);

    if (countError) throw countError;

    if (!topLevelIds || topLevelIds.length === 0) {
      return NextResponse.json({
        success: true,
        comments: [],
        total: count || 0
      });
    }

    const ids = topLevelIds.map(c => c.id);

    // Fetch all comments in these threads (recursive-ish)
    // For MVP, we'll fetch all comments for this feedback and build thread locally
    // If there are thousands, this might be slow, but for MVP parity it should be fine
    const { data: allComments, error: fetchError } = await supabase
      .from('comments')
      .select('*, user:users(id, email)')
      .eq('feedback_id', feedbackId)
      .is('deleted_at', null)
      .order('created_at', { ascending: sort === 'oldest' });

    if (fetchError) throw fetchError;

    const thread = await buildCommentThread(allComments as any);
    
    // Filter thread to only include the paginated top-level comments
    const paginatedThread = thread.filter(c => ids.includes(c.id));

    return NextResponse.json({
      success: true,
      comments: paginatedThread,
      total: count || 0
    });
  } catch (error) {
    return handleError(error);
  }
}
