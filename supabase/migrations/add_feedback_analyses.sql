-- Add feedback analyses table for automated feedback analysis
CREATE TABLE IF NOT EXISTS feedback_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_provider TEXT NOT NULL CHECK (ai_provider IN ('gemini', 'deepseek')),
  feedback_count INTEGER NOT NULL DEFAULT 0,
  cluster_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Add feedback clusters analysis table (extended clusters with analysis data)
CREATE TABLE IF NOT EXISTS feedback_clusters_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES feedback_analyses(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES feedback_clusters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('Very Negative', 'Negative', 'Neutral', 'Positive', 'Mixed')),
  priority_score INTEGER CHECK (priority_score >= 1 AND priority_score <= 10),
  effort_estimate TEXT CHECK (effort_estimate IN ('Low', 'Medium', 'High')),
  key_quotes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add roadmap items analysis table (AI-generated roadmap items)
CREATE TABLE IF NOT EXISTS roadmap_items_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES feedback_analyses(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES feedback_clusters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  expected_impact TEXT,
  risks TEXT,
  suggested_quarter TEXT CHECK (suggested_quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  cluster_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_analyses_project_id ON feedback_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analyses_user_id ON feedback_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analyses_created_at ON feedback_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_clusters_analysis_analysis_id ON feedback_clusters_analysis(analysis_id);
CREATE INDEX IF NOT EXISTS idx_feedback_clusters_analysis_cluster_id ON feedback_clusters_analysis(cluster_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_analysis_analysis_id ON roadmap_items_analysis(analysis_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_analysis_cluster_id ON roadmap_items_analysis(cluster_id);

-- Add triggers for updated_at
CREATE TRIGGER update_feedback_analyses_updated_at BEFORE UPDATE ON feedback_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE feedback_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_clusters_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_items_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feedback_analyses
CREATE POLICY "Users can view analyses for their projects" ON feedback_analyses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_analyses.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create analyses for their projects" ON feedback_analyses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_analyses.project_id AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for feedback_clusters_analysis
CREATE POLICY "Users can view cluster analyses for their projects" ON feedback_clusters_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feedback_analyses fa
      JOIN projects p ON fa.project_id = p.id
      WHERE fa.id = feedback_clusters_analysis.analysis_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create cluster analyses for their projects" ON feedback_clusters_analysis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM feedback_analyses fa
      JOIN projects p ON fa.project_id = p.id
      WHERE fa.id = feedback_clusters_analysis.analysis_id AND p.user_id = auth.uid()
    )
  );

-- RLS Policies for roadmap_items_analysis
CREATE POLICY "Users can view roadmap analyses for their projects" ON roadmap_items_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feedback_analyses fa
      JOIN projects p ON fa.project_id = p.id
      WHERE fa.id = roadmap_items_analysis.analysis_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create roadmap analyses for their projects" ON roadmap_items_analysis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM feedback_analyses fa
      JOIN projects p ON fa.project_id = p.id
      WHERE fa.id = roadmap_items_analysis.analysis_id AND p.user_id = auth.uid()
    )
  );