-- Sentiment Analysis and Auto-Categorization Tables

-- Sentiment analysis results table
CREATE TABLE IF NOT EXISTS feedback_sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(feedback_id)
);

-- Auto-categorization results table
CREATE TABLE IF NOT EXISTS feedback_topic_auto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  topic_name VARCHAR(100) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_feedback ON feedback_sentiment_analysis(feedback_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_sentiment ON feedback_sentiment_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_topic_auto_project ON feedback_topic_auto(project_id);
CREATE INDEX IF NOT EXISTS idx_topic_auto_feedback ON feedback_topic_auto(feedback_id);
CREATE INDEX IF NOT EXISTS idx_topic_auto_topic ON feedback_topic_auto(topic_name);

-- RLS Policies
ALTER TABLE feedback_sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_topic_auto ENABLE ROW LEVEL SECURITY;

-- Users can view sentiment analysis from their projects
CREATE POLICY "Users can view sentiment analysis from their projects" ON feedback_sentiment_analysis
  FOR SELECT USING (
    feedback_id IN (
      SELECT id FROM feedback_items 
      WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- System can insert sentiment analysis
CREATE POLICY "System can insert sentiment analysis" ON feedback_sentiment_analysis
  FOR INSERT WITH CHECK (true);

-- Users can update sentiment analysis (for corrections)
CREATE POLICY "Users can update sentiment analysis" ON feedback_sentiment_analysis
  FOR UPDATE USING (
    feedback_id IN (
      SELECT id FROM feedback_items 
      WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- Users can view auto-categorization from their projects
CREATE POLICY "Users can view auto-categorization from their projects" ON feedback_topic_auto
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- System can insert auto-categorization
CREATE POLICY "System can insert auto-categorization" ON feedback_topic_auto
  FOR INSERT WITH CHECK (true);

-- Users can update auto-categorization (for corrections)
CREATE POLICY "Users can update auto-categorization" ON feedback_topic_auto
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );