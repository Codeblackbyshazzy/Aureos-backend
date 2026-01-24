-- Phase 4: Polish & Advanced - Enterprise Excellence
-- Database schema for Idea Polls Enhancements, Custom Domains, Advanced Search, and Real-time Subscriptions

-- =============================================
-- IDEA POLLS ENHANCEMENTS
-- =============================================

ALTER TABLE idea_polls ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'single_choice' CHECK (type IN ('single_choice', 'multiple_choice', 'ranking'));
ALTER TABLE idea_polls ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE idea_polls ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
ALTER TABLE idea_polls ADD COLUMN IF NOT EXISTS allow_retraction BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS poll_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES idea_polls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- CUSTOM DOMAINS TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  ssl_status TEXT NOT NULL DEFAULT 'none' CHECK (ssl_status IN ('none', 'pending', 'active', 'expired')),
  verification_method TEXT NOT NULL DEFAULT 'dns-txt' CHECK (verification_method IN ('dns-txt', 'dns-cname', 'http')),
  verification_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS domain_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES custom_domains(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES custom_domains(id) ON DELETE CASCADE,
  branding_settings JSONB DEFAULT '{}',
  custom_css TEXT,
  custom_js TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- SEARCH ENHANCEMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS search_indexes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  index_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_config JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- REAL-TIME SUBSCRIPTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS realtime_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_types TEXT[] NOT NULL,
  channel_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_poll_analytics_poll_id ON poll_analytics(poll_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_project_id ON custom_domains(project_id);
CREATE INDEX IF NOT EXISTS idx_domain_verifications_domain_id ON domain_verifications(domain_id);
CREATE INDEX IF NOT EXISTS idx_search_indexes_project_id ON search_indexes(project_id);
CREATE INDEX IF NOT EXISTS idx_search_filters_project_id ON search_filters(project_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_project_id ON search_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_project_user ON realtime_subscriptions(project_id, user_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE poll_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_subscriptions ENABLE ROW LEVEL SECURITY;

-- Poll Analytics
CREATE POLICY "Users can view poll analytics for their projects" ON poll_analytics
  FOR SELECT USING (poll_id IN (
    SELECT id FROM idea_polls WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  ));

-- Custom Domains
CREATE POLICY "Users can manage custom domains for their projects" ON custom_domains
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Domain Verifications
CREATE POLICY "Users can view domain verifications for their domains" ON domain_verifications
  FOR ALL USING (domain_id IN (
    SELECT id FROM custom_domains WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  ));

-- Domain Settings
CREATE POLICY "Users can manage domain settings for their domains" ON domain_settings
  FOR ALL USING (domain_id IN (
    SELECT id FROM custom_domains WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  ));

-- Search Indexes
CREATE POLICY "Users can manage search indexes for their projects" ON search_indexes
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Search Filters
CREATE POLICY "Users can manage search filters for their projects" ON search_filters
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Search Analytics
CREATE POLICY "Users can view search analytics for their projects" ON search_analytics
  FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Real-time Subscriptions
CREATE POLICY "Users can manage their own realtime subscriptions" ON realtime_subscriptions
  FOR ALL USING (user_id = auth.uid());
