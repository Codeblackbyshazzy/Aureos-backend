import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { statusSchema } from '@/lib/validation-phase1';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { applyRateLimit } from '@/lib/rate-limiter';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> }
) {
  try {
    const { id: projectId, statusId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    await getProjectWithOwnership(projectId, user.id);

    const body = await req.json();
    const validated = statusSchema.partial().parse(body);

    const supabase = await createServerClient();

    const { data: updatedStatus, error } = await supabase
      .from('feedback_statuses')
      .update({
        ...validated,
        updated_at: new Date().toISOString()
      })
      .eq('id', statusId)
      .eq('project_id', projectId)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Status not found', code: ErrorCodes.STATUS_NOT_FOUND },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      status: updatedStatus
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> }
) {
  try {
    const { id: projectId, statusId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    await getProjectWithOwnership(projectId, user.id);

    const supabase = await createServerClient();

    // Check if default
    const { data: status, error: fetchError } = await supabase
      .from('feedback_statuses')
      .select('is_default')
      .eq('id', statusId)
      .single();

    if (fetchError || !status) {
      return NextResponse.json(
        { success: false, error: 'Status not found', code: ErrorCodes.STATUS_NOT_FOUND },
        { status: 404 }
      );
    }

    if (status.is_default) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete default status', code: ErrorCodes.CANNOT_DELETE_DEFAULT_STATUS },
        { status: 400 }
      );
    }

    // Set feedback with this status to null
    await supabase
      .from('feedback_items')
      .update({ status_id: null })
      .eq('status_id', statusId);

    // Delete status
    const { error: deleteError } = await supabase
      .from('feedback_statuses')
      .delete()
      .eq('id', statusId)
      .eq('project_id', projectId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    return handleError(error);
  }
}
