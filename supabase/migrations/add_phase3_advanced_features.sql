-- Phase 3: Beyond Parity - Advanced Features
-- Database schema for Surveys, Integrations, Analytics, and Multi-language Support

-- =============================================
-- SURVEYS TABLES
-- =============================================

-- Survey templates
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Survey questions
CREATE TABLE IF NOT EXISTS survey_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'single_choice', 'text', 'rating', 'yes_no')),
  options JSONB DEFAULT '[]', -- Array of option objects for choice questions
  required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Survey responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  respondent_email TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Survey response answers
CREATE TABLE IF NOT EXISTS survey_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_value JSONB, -- For complex answers like multiple selections
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INTEGRATIONS TABLES
-- =============================================

-- Integration providers configuration
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'discord', 'github', 'zapier', 'mailchimp', 'intercom')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}', -- Provider-specific configuration
  credentials JSONB DEFAULT '{}', -- Encrypted credentials
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ
);

-- Integration logs
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ANALYTICS TABLES
-- =============================================

-- Analytics events for tracking
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Aggregated analytics data
CREATE TABLE IF NOT EXISTS analytics_aggregates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  date DATE NOT NULL,
  hour INTEGER CHECK (hour >= 0 AND hour <= 23),
  value FLOAT NOT NULL DEFAULT 0,
  dimensions JSONB DEFAULT '{}', -- Additional dimensions for grouping
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, metric_name, date, hour)
);

-- Custom metrics definition
CREATE TABLE IF NOT EXISTS custom_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  formula TEXT, -- SQL formula for calculation
  chart_type TEXT DEFAULT 'line' CHECK (chart_type IN ('line', 'bar', 'pie', 'metric')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  widget_type TEXT NOT NULL CHECK (widget_type IN ('metric', 'chart', 'table', 'list')),
  metric_name TEXT, -- For metric widgets
  custom_metric_id UUID REFERENCES custom_metrics(id) ON DELETE SET NULL,
  configuration JSONB DEFAULT '{}',
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 1,
  height INTEGER NOT NULL DEFAULT 1,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- MULTI-LANGUAGE SUPPORT TABLES
-- =============================================

-- Project languages
CREATE TABLE IF NOT EXISTS project_languages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, language_code)
);

-- Translations
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  context TEXT, -- Optional context for the translation
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, language_code, key)
);

-- User language preferences
CREATE TABLE IF NOT EXISTS user_language_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  preference_level INTEGER NOT NULL DEFAULT 1 CHECK (preference_level >= 1 AND preference_level <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, language_code)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Survey indexes
CREATE INDEX IF NOT EXISTS idx_surveys_project_id ON surveys(project_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_id ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response_id ON survey_answers(response_id);

-- Integration indexes
CREATE INDEX IF NOT EXISTS idx_integrations_project_id ON integrations(project_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON integration_logs(integration_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_project_id ON analytics_events(project_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_project_metric ON analytics_aggregates(project_id, metric_name, date);
CREATE INDEX IF NOT EXISTS idx_custom_metrics_project_id ON custom_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_project_id ON dashboard_widgets(project_id);

-- Language indexes
CREATE INDEX IF NOT EXISTS idx_project_languages_project_id ON project_languages(project_id);
CREATE INDEX IF NOT EXISTS idx_translations_project_language ON translations(project_id, language_code);
CREATE INDEX IF NOT EXISTS idx_user_language_preferences_user_id ON user_language_preferences(user_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_language_preferences ENABLE ROW LEVEL SECURITY;

-- Surveys RLS policies
CREATE POLICY "Users can view surveys for their projects" ON surveys
  FOR SELECT USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create surveys for their projects" ON surveys
  FOR INSERT WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update surveys for their projects" ON surveys
  FOR UPDATE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete surveys for their projects" ON surveys
  FOR DELETE USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Survey questions RLS policies
CREATE POLICY "Users can manage questions for their surveys" ON survey_questions
  FOR ALL USING (survey_id IN (
    SELECT id FROM surveys WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  ));

-- Survey responses RLS policies
CREATE POLICY "Users can view responses for their surveys" ON survey_responses
  FOR SELECT USING (survey_id IN (
    SELECT id FROM surveys WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can create responses for their surveys" ON survey_responses
  FOR INSERT WITH CHECK (survey_id IN (
    SELECT id FROM surveys WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  ));

-- Survey answers RLS policies
CREATE POLICY "Users can manage answers for their survey responses" ON survey_answers
  FOR ALL USING (response_id IN (
    SELECT id FROM survey_responses WHERE survey_id IN (
      SELECT id FROM surveys WHERE project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  ));

-- Integrations RLS policies
CREATE POLICY "Users can manage integrations for their projects" ON integrations
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view integration logs for their integrations" ON integration_logs
  FOR ALL USING (integration_id IN (
    SELECT id FROM integrations WHERE project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  ));

-- Analytics RLS policies
CREATE POLICY "Users can manage analytics for their projects" ON analytics_events
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage analytics aggregates for their projects" ON analytics_aggregates
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage custom metrics for their projects" ON custom_metrics
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage dashboard widgets for their projects" ON dashboard_widgets
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Language support RLS policies
CREATE POLICY "Users can manage languages for their projects" ON project_languages
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage translations for their projects" ON translations
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own language preferences" ON user_language_preferences
  FOR ALL USING (user_id = auth.uid());