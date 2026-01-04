import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { feedbackTopicsSchema } from '@/lib/validation-phase1';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { applyRateLimit } from '@/lib/rate-limiter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  try {
    const { id: projectId, feedbackId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    await getProjectWithOwnership(projectId, user.id);

    const body = await req.json();
    const { topicIds } = feedbackTopicsSchema.parse(body);

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

    // Verify all topics belong to the same project
    const { data: validTopics, error: topicsError } = await supabase
      .from('topics')
      .select('id')
      .eq('project_id', projectId)
      .in('id', topicIds);

    if (topicsError) throw topicsError;

    if (validTopics.length !== topicIds.length) {
      throw new Error('One or more topics are invalid or belong to another project');
    }

    // Delete existing mappings
    const { error: deleteError } = await supabase
      .from('feedback_topics')
      .delete()
      .eq('feedback_id', feedbackId);

    if (deleteError) throw deleteError;

    // Insert new mappings
    if (topicIds.length > 0) {
      const { error: insertError } = await supabase
        .from('feedback_topics')
        .insert(topicIds.map(topicId => ({
          feedback_id: feedbackId,
          topic_id: topicId
        })));

      if (insertError) throw insertError;
    }

    // Return updated topics
    const { data: updatedTopics } = await supabase
      .from('topics')
      .select('*')
      .in('id', topicIds);

    return NextResponse.json({
      success: true,
      topics: updatedTopics || []
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
    const supabase = await createServerClient();

    const { data: topics, error } = await supabase
      .from('topics')
      .select('*, feedback_topics!inner(feedback_id)')
      .eq('feedback_topics.feedback_id', feedbackId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      topics
    });
  } catch (error) {
    return handleError(error);
  }
}
