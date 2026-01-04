CREATE TABLE feedback_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feedback_id, user_id)
);

ALTER TABLE feedback_items ADD COLUMN follower_count INT DEFAULT 0;

CREATE INDEX idx_followers_feedback ON feedback_followers(feedback_id);
CREATE INDEX idx_followers_user ON feedback_followers(user_id);

-- Enable RLS
ALTER TABLE feedback_followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view followers" ON feedback_followers
  FOR SELECT USING (true);

CREATE POLICY "Users can follow feedback" ON feedback_followers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow feedback" ON feedback_followers
  FOR DELETE USING (auth.uid() = user_id);
