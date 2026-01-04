CREATE TABLE guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  one_time BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guest_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_guest_sessions_project ON guest_sessions(project_id);
CREATE INDEX idx_guest_sessions_expires_at ON guest_sessions(expires_at);
CREATE INDEX idx_guest_sessions_revoked_at ON guest_sessions(revoked_at);
CREATE INDEX idx_guest_access_tokens_session ON guest_access_tokens(session_id);

-- Enable RLS
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_access_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Project owners can manage guest sessions" ON guest_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = guest_sessions.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage guest tokens" ON guest_access_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM guest_sessions gs
      JOIN projects p ON gs.project_id = p.id
      WHERE gs.id = guest_access_tokens.session_id AND p.user_id = auth.uid()
    )
  );
