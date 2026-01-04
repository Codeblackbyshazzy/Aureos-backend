-- Idea Polls Tables
CREATE TABLE idea_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  closed_at TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES idea_polls(id) ON DELETE CASCADE,
  option_text VARCHAR(500) NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES idea_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Indexes
CREATE INDEX idx_polls_project ON idea_polls(project_id);
CREATE INDEX idx_poll_options_poll ON poll_options(poll_id);
CREATE INDEX idx_votes_poll ON poll_votes(poll_id);
CREATE INDEX idx_votes_option ON poll_votes(option_id);
CREATE INDEX idx_polls_status ON idea_polls(status);

-- RLS Policies
ALTER TABLE idea_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Users can only access polls from their projects
CREATE POLICY "Users can view polls from their projects" ON idea_polls
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create polls in their projects" ON idea_polls
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Project owners can update polls" ON idea_polls
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can delete polls" ON idea_polls
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Poll options policies
CREATE POLICY "Users can view poll options from their projects" ON poll_options
  FOR SELECT USING (
    poll_id IN (
      SELECT id FROM idea_polls 
      WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Project owners can manage poll options" ON poll_options
  FOR ALL USING (
    poll_id IN (
      SELECT id FROM idea_polls 
      WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- Poll votes policies
CREATE POLICY "Users can view votes from their projects" ON poll_votes
  FOR SELECT USING (
    poll_id IN (
      SELECT id FROM idea_polls 
      WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated users can vote" ON poll_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON poll_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON poll_votes
  FOR DELETE USING (auth.uid() = user_id);