-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback items table
CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'import', 'api', 'web')),
  source_url TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  deleted_at TIMESTAMPTZ
);

-- Feedback clusters table
CREATE TABLE IF NOT EXISTS feedback_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  priority_score FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cluster feedback relationship table
CREATE TABLE IF NOT EXISTS cluster_feedback_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID NOT NULL REFERENCES feedback_clusters(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cluster_id, feedback_id)
);

-- Roadmap items table
CREATE TABLE IF NOT EXISTS roadmap_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES feedback_clusters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service TEXT NOT NULL CHECK (service IN ('gemini', 'deepseek', 'firecrawl')),
  tokens_or_credits FLOAT NOT NULL DEFAULT 0,
  cost_estimate FLOAT NOT NULL DEFAULT 0,
  endpoint TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'paused')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_feedback_items_project_id ON feedback_items(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_items_created_at ON feedback_items(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_items_deleted_at ON feedback_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_feedback_clusters_project_id ON feedback_clusters(project_id);
CREATE INDEX IF NOT EXISTS idx_cluster_feedback_cluster_id ON cluster_feedback_items(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_feedback_feedback_id ON cluster_feedback_items(feedback_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_project_id ON roadmap_items(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_cluster_id ON roadmap_items(cluster_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_project_id ON api_usage_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_timestamp ON api_usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_service ON api_usage_logs(service);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_clusters_updated_at BEFORE UPDATE ON feedback_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roadmap_items_updated_at BEFORE UPDATE ON roadmap_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Feedback items policies
CREATE POLICY "Users can view feedback for their projects" ON feedback_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_items.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create feedback for their projects" ON feedback_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_items.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update feedback for their projects" ON feedback_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_items.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete feedback for their projects" ON feedback_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_items.project_id AND projects.user_id = auth.uid()
    )
  );

-- Feedback clusters policies (similar to feedback_items)
CREATE POLICY "Users can view clusters for their projects" ON feedback_clusters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_clusters.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create clusters for their projects" ON feedback_clusters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_clusters.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update clusters for their projects" ON feedback_clusters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_clusters.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete clusters for their projects" ON feedback_clusters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = feedback_clusters.project_id AND projects.user_id = auth.uid()
    )
  );

-- Roadmap items policies - public read, owner write
CREATE POLICY "Anyone can view roadmap items" ON roadmap_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create roadmap items for their projects" ON roadmap_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = roadmap_items.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update roadmap items for their projects" ON roadmap_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = roadmap_items.project_id AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete roadmap items for their projects" ON roadmap_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = roadmap_items.project_id AND projects.user_id = auth.uid()
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- API usage logs policies
CREATE POLICY "Users can view their own API usage" ON api_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Cluster feedback items policies
CREATE POLICY "Users can view cluster feedback mappings" ON cluster_feedback_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feedback_clusters fc
      JOIN projects p ON fc.project_id = p.id
      WHERE fc.id = cluster_feedback_items.cluster_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create cluster feedback mappings" ON cluster_feedback_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM feedback_clusters fc
      JOIN projects p ON fc.project_id = p.id
      WHERE fc.id = cluster_feedback_items.cluster_id AND p.user_id = auth.uid()
    )
  );
