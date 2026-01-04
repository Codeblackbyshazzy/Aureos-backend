import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { topicSchema } from '@/lib/validation-phase1';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { applyRateLimit } from '@/lib/rate-limiter';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  try {
    const { id: projectId, topicId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    await getProjectWithOwnership(projectId, user.id);

    const body = await req.json();
    const validated = topicSchema.partial().parse(body);

    const supabase = await createServerClient();

    const { data: updatedTopic, error } = await supabase
      .from('topics')
      .update({
        ...validated,
        updated_at: new Date().toISOString()
      })
      .eq('id', topicId)
      .eq('project_id', projectId)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Topic not found', code: ErrorCodes.TOPIC_NOT_FOUND },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      topic: updatedTopic
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  try {
    const { id: projectId, topicId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    await getProjectWithOwnership(projectId, user.id);

    const supabase = await createServerClient();

    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', topicId)
      .eq('project_id', projectId);

    if (error) throw error;

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    return handleError(error);
  }
}
