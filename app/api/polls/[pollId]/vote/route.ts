import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { voteOnPoll, getPollResults } from '@/lib/polls';
import { handleError } from '@/lib/errors';
import { z } from 'zod';
import { VoteRequest } from '@/types';
import { createServerClient } from '@/lib/supabase';

const voteSchema = z.object({
  option_id: z.string().uuid()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    const { pollId } = params;
    const user = await requireAuth(request);

    const body = await request.json();
    const validatedData = voteSchema.parse(body) as VoteRequest;

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
      .eq('user_id', user.userId)
      .single();

    if (projectError) throw projectError;

    const vote = await voteOnPoll(pollId, validatedData.option_id, user.userId);

    return NextResponse.json({
      success: true,
      data: vote
    });
  } catch (error) {
    return handleError(error);
  }
}