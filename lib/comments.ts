import { SupabaseClient } from '@supabase/supabase-js';
import { Comment } from '@/types';

export interface CommentWithReplies extends Comment {
  replies: CommentWithReplies[];
}

/**
 * Builds a nested comment thread from a flat list of comments
 */
export async function buildCommentThread(
  comments: Comment[],
  maxDepth: number = 3
): Promise<CommentWithReplies[]> {
  const commentMap = new Map<string, CommentWithReplies>();
  const roots: CommentWithReplies[] = [];

  // Initialize map with comments and empty replies
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Build tree
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id)!;
    if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
      const parent = commentMap.get(comment.parent_comment_id)!;
      
      // Check depth (simplified)
      let depth = 0;
      let curr = parent;
      while (curr.parent_comment_id && commentMap.has(curr.parent_comment_id)) {
        curr = commentMap.get(curr.parent_comment_id)!;
        depth++;
      }

      if (depth < maxDepth) {
        parent.replies.push(commentWithReplies);
      } else {
        // If too deep, attach to the max depth parent or treat as root?
        // Requirements say max 3 levels, so we'll just not add as reply if deeper
        roots.push(commentWithReplies);
      }
    } else {
      roots.push(commentWithReplies);
    }
  });

  return roots;
}

/**
 * Gets the ancestry of a comment (IDs of all parent comments)
 */
export async function getCommentAncestry(
  commentId: string,
  client: SupabaseClient
): Promise<string[]> {
  const ancestry: string[] = [];
  let currentId: string | null = commentId;

  while (currentId) {
    const { data, error } = await client
      .from('comments')
      .select('parent_comment_id')
      .eq('id', currentId)
      .single();

    if (error || !data || !data.parent_comment_id) {
      currentId = null;
    } else {
      ancestry.push(data.parent_comment_id);
      currentId = data.parent_comment_id;
    }
  }

  return ancestry;
}

/**
 * Increments the comment count for a feedback item
 */
export async function incrementCommentCount(feedbackId: string, client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('increment', {
    table_name: 'feedback_items',
    row_id: feedbackId,
    column_name: 'comment_count',
    amount: 1
  });
  if (error) throw error;
}

/**
 * Decrements the comment count for a feedback item
 */
export async function decrementCommentCount(feedbackId: string, client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('increment', {
    table_name: 'feedback_items',
    row_id: feedbackId,
    column_name: 'comment_count',
    amount: -1
  });
  if (error) throw error;
}
