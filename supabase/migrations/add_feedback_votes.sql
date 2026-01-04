-- feedback_votes table
CREATE TABLE feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feedback_id, user_id)
);

-- Add vote_count to feedback_items
ALTER TABLE feedback_items ADD COLUMN vote_count INT DEFAULT 0;

-- Create index for fast lookups
CREATE INDEX idx_feedback_votes_user ON feedback_votes(user_id);
CREATE INDEX idx_feedback_votes_feedback ON feedback_votes(feedback_id);

-- Enable RLS
ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all votes" ON feedback_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can vote" ON feedback_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own vote" ON feedback_votes
  FOR DELETE USING (auth.uid() = user_id);
