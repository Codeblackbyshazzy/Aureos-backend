import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { commentUpdateSchema } from '@/lib/validation-phase1';
import { applyRateLimit } from '@/lib/rate-limiter';
import { decrementCommentCount } from '@/lib/comments';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    const body = await req.json();
    const validated = commentUpdateSchema.parse(body);

    const supabase = await createServerClient();

    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found', code: ErrorCodes.COMMENT_NOT_FOUND },
        { status: 404 }
      );
    }

    if (comment.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({
        text: validated.text,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      comment: updatedComment
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    const supabase = await createServerClient();

    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found', code: ErrorCodes.COMMENT_NOT_FOUND },
        { status: 404 }
      );
    }

    if (comment.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from('comments')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', commentId);

    if (deleteError) throw deleteError;

    // Decrement count
    await decrementCommentCount(comment.feedback_id, supabase);

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    return handleError(error);
  }
}
