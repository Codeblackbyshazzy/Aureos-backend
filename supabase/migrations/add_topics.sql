CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7),
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name)
);

CREATE TABLE feedback_topics (
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (feedback_id, topic_id)
);

CREATE INDEX idx_topics_project ON topics(project_id);
CREATE INDEX idx_feedback_topics_feedback ON feedback_topics(feedback_id);
CREATE INDEX idx_feedback_topics_topic ON feedback_topics(topic_id);

-- Enable RLS
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for topics
CREATE POLICY "Anyone can view topics" ON topics
  FOR SELECT USING (true);

CREATE POLICY "Project owners can manage topics" ON topics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = topics.project_id AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for feedback_topics
CREATE POLICY "Anyone can view feedback topics" ON feedback_topics
  FOR SELECT USING (true);

CREATE POLICY "Project owners can manage feedback topics" ON feedback_topics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM feedback_items fi
      JOIN projects p ON fi.project_id = p.id
      WHERE fi.id = feedback_topics.feedback_id AND p.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
