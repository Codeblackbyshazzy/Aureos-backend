CREATE TABLE sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('oidc', 'saml')),
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,

  -- OIDC fields
  oidc_issuer_url TEXT,
  oidc_client_id TEXT,
  oidc_client_secret TEXT,
  oidc_redirect_url TEXT,
  oidc_scopes TEXT[] NOT NULL DEFAULT ARRAY['openid', 'email', 'profile'],

  -- SAML fields (minimal storage to support enterprise providers)
  saml_entity_id TEXT,
  saml_sso_url TEXT,
  saml_certificate TEXT,

  attribute_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id)
);

CREATE TABLE sso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('oidc', 'saml')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),

  -- Anti-CSRF state/nonce
  state TEXT NOT NULL,
  nonce TEXT,
  code_verifier TEXT,

  -- Populated after callback
  external_user_id TEXT,
  email TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  UNIQUE(project_id, state)
);

CREATE INDEX idx_sso_configurations_project ON sso_configurations(project_id);
CREATE INDEX idx_sso_sessions_project ON sso_sessions(project_id);
CREATE INDEX idx_sso_sessions_state ON sso_sessions(state);
CREATE INDEX idx_sso_sessions_status ON sso_sessions(status);

-- Enable RLS
ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Project owners can view SSO config" ON sso_configurations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = sso_configurations.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage SSO config" ON sso_configurations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = sso_configurations.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can view SSO sessions" ON sso_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = sso_sessions.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can revoke SSO sessions" ON sso_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = sso_sessions.project_id AND p.user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER update_sso_configurations_updated_at BEFORE UPDATE ON sso_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
