import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { statusSchema } from '@/lib/validation-phase1';
import { getProjectWithOwnership } from '@/lib/project-utils';
import { applyRateLimit } from '@/lib/rate-limiter';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await requireAuth();
    await applyRateLimit(user.id, user.role);
    await getProjectWithOwnership(projectId, user.id);

    const body = await req.json();
    const validated = statusSchema.parse(body);

    const supabase = await createServerClient();

    // Check max statuses
    const { count } = await supabase
      .from('feedback_statuses')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if ((count || 0) >= 20) {
      return NextResponse.json(
        { success: false, error: 'Maximum 20 statuses per project', code: ErrorCodes.MAX_STATUSES_EXCEEDED },
        { status: 400 }
      );
    }

    // Check duplicate name
    const { data: existing } = await supabase
      .from('feedback_statuses')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', validated.name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Status already exists', code: 'DUPLICATE_STATUS' },
        { status: 409 }
      );
    }

    const { data: status, error } = await supabase
      .from('feedback_statuses')
      .insert({
        project_id: projectId,
        name: validated.name,
        color: validated.color,
        icon: validated.icon,
        display_order: validated.display_order || 0
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    await requireAuth();
    const supabase = await createServerClient();

    const { data: statuses, error } = await supabase
      .from('feedback_statuses')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      statuses
    });
  } catch (error) {
    return handleError(error);
  }
}
