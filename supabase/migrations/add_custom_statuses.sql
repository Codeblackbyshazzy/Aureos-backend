CREATE TABLE feedback_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  icon VARCHAR(50),
  display_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name)
);

ALTER TABLE feedback_items 
ADD COLUMN status_id UUID REFERENCES feedback_statuses(id) ON DELETE SET NULL;

CREATE INDEX idx_statuses_project ON feedback_statuses(project_id);
CREATE INDEX idx_feedback_status ON feedback_items(status_id);

-- Enable RLS
ALTER TABLE feedback_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view statuses" ON feedback_statuses
  FOR SELECT USING (true);

CREATE POLICY "Project owners can manage statuses" ON feedback_statuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_statuses.project_id AND projects.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_feedback_statuses_updated_at BEFORE UPDATE ON feedback_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
