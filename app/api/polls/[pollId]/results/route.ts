import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPollResults } from '@/lib/polls';
import { handleError } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    const { pollId } = params;
    const user = await requireAuth();

    // Get poll to verify user has access
    const supabase = createServerClient();
    const { data: poll, error: pollError } = await supabase
      .from('idea_polls')
      .select('project_id')
      .eq('id', pollId)
      .single();

    if (pollError) throw pollError;

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', poll.project_id)
      .eq('user_id', user.id)
      .single();

    if (projectError) throw projectError;

    const results = await getPollResults(pollId, user.id);

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    return handleError(error);
  }
}