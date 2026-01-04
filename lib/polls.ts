import { createServerClient, createAdminClient } from './supabase';
import { IdeaPoll, PollOption, PollVote, PollResults } from '../types';
import { generateVerificationToken } from './domains';

export async function createPoll(
  projectId: string,
  userId: string,
  title: string,
  description: string | null,
  options: string[],
  status: 'active' | 'closed' | 'draft' = 'active'
) {
  const supabase = createAdminClient();

  // Create the poll
  const { data: poll, error: pollError } = await supabase
    .from('idea_polls')
    .insert({
      project_id: projectId,
      title,
      description,
      status,
      created_by: userId
    })
    .select()
    .single();

  if (pollError) throw pollError;

  // Create poll options
  const pollOptions = options.map((optionText, index) => ({
    poll_id: poll.id,
    option_text: optionText,
    display_order: index
  }));

  const { data: createdOptions, error: optionsError } = await supabase
    .from('poll_options')
    .insert(pollOptions)
    .select();

  if (optionsError) throw optionsError;

  return { poll, options: createdOptions };
}

export async function getPolls(projectId: string, userId: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('idea_polls')
    .select(`
      *,
      created_by_user:users!idea_polls_created_by_fkey(email)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

export async function getPollWithOptions(pollId: string, userId: string) {
  const supabase = createServerClient();

  const { data: poll, error: pollError } = await supabase
    .from('idea_polls')
    .select(`
      *,
      created_by_user:users!idea_polls_created_by_fkey(email)
    `)
    .eq('id', pollId)
    .single();

  if (pollError) throw pollError;

  const { data: options, error: optionsError } = await supabase
    .from('poll_options')
    .select('*')
    .eq('poll_id', pollId)
    .order('display_order');

  if (optionsError) throw optionsError;

  return { poll, options };
}

export async function getPollResults(pollId: string, userId: string): Promise<PollResults> {
  const supabase = createServerClient();

  // Get poll with options
  const { poll, options } = await getPollWithOptions(pollId, userId);

  // Get vote counts for each option
  const { data: voteCounts, error: votesError } = await supabase
    .from('poll_votes')
    .select('option_id')
    .eq('poll_id', pollId);

  if (votesError) throw votesError;

  // Count votes per option
  const optionVoteCounts = new Map<string, number>();
  options.forEach(option => optionVoteCounts.set(option.id, 0));

  voteCounts?.forEach(vote => {
    const current = optionVoteCounts.get(vote.option_id) || 0;
    optionVoteCounts.set(vote.option_id, current + 1);
  });

  // Check if user has voted
  const { data: userVote } = await supabase
    .from('poll_votes')
    .select('option_id')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .single();

  const totalVotes = voteCounts?.length || 0;

  const results = {
    poll,
    options: options.map(option => ({
      ...option,
      vote_count: optionVoteCounts.get(option.id) || 0,
      percentage: totalVotes > 0 ? Math.round(((optionVoteCounts.get(option.id) || 0) / totalVotes) * 100) : 0,
      user_voted: userVote?.option_id === option.id
    })),
    total_votes: totalVotes,
    user_has_voted: !!userVote
  };

  return results;
}

export async function updatePoll(
  pollId: string,
  userId: string,
  updates: {
    title?: string;
    description?: string;
    status?: 'active' | 'closed' | 'draft';
    closed_at?: string | null;
  }
) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('idea_polls')
    .update(updates)
    .eq('id', pollId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deletePoll(pollId: string, userId: string) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('idea_polls')
    .delete()
    .eq('id', pollId);

  if (error) throw error;

  return true;
}

export async function voteOnPoll(pollId: string, optionId: string, userId: string) {
  const supabase = createServerClient();

  // Check if poll is active
  const { data: poll, error: pollError } = await supabase
    .from('idea_polls')
    .select('status')
    .eq('id', pollId)
    .single();

  if (pollError) throw pollError;

  if (poll.status !== 'active') {
    throw new Error('Poll is not active');
  }

  // Check if user has already voted
  const { data: existingVote } = await supabase
    .from('poll_votes')
    .select('id')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .single();

  let vote;
  if (existingVote) {
    // Update existing vote
    const { data, error } = await supabase
      .from('poll_votes')
      .update({ option_id: optionId })
      .eq('id', existingVote.id)
      .select()
      .single();

    if (error) throw error;
    vote = data;
  } else {
    // Create new vote
    const { data, error } = await supabase
      .from('poll_votes')
      .insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: userId
      })
      .select()
      .single();

    if (error) throw error;
    vote = data;
  }

  return vote;
}

export async function addPollOptions(pollId: string, options: string[], userId: string) {
  const supabase = createServerClient();

  // Get current max display order
  const { data: maxOrder } = await supabase
    .from('poll_options')
    .select('display_order')
    .eq('poll_id', pollId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const startOrder = (maxOrder?.display_order || -1) + 1;

  const pollOptions = options.map((optionText, index) => ({
    poll_id: pollId,
    option_text: optionText,
    display_order: startOrder + index
  }));

  const { data, error } = await supabase
    .from('poll_options')
    .insert(pollOptions)
    .select();

  if (error) throw error;

  return data;
}

export async function removePollOption(optionId: string, userId: string) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('poll_options')
    .delete()
    .eq('id', optionId);

  if (error) throw error;

  return true;
}