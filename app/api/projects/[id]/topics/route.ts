import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import { topicSchema } from '@/lib/validation-phase1';
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
    const validated = topicSchema.parse(body);

    const supabase = await createServerClient();

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('topics')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', validated.name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Topic already exists', code: ErrorCodes.DUPLICATE_TOPIC },
        { status: 409 }
      );
    }

    const { data: topic, error } = await supabase
      .from('topics')
      .insert({
        project_id: projectId,
        name: validated.name,
        color: validated.color,
        icon: validated.icon
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      topic
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
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const supabase = await createServerClient();

    const { data: topics, error } = await supabase
      .from('topics')
      .select('*')
      .eq('project_id', projectId)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      topics
    });
  } catch (error) {
    return handleError(error);
  }
}
