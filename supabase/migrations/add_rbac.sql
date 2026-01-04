-- Advanced RBAC (Role-Based Access Control)

-- Project roles table
CREATE TABLE project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Project members table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES project_roles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX idx_project_roles_project ON project_roles(project_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role_id);

-- RLS Policies
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Only project owners can manage roles
CREATE POLICY "Project owners can manage roles" ON project_roles
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can view roles from their projects
CREATE POLICY "Users can view roles from their projects" ON project_roles
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Only project owners can manage members
CREATE POLICY "Project owners can manage members" ON project_members
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can view members from their projects
CREATE POLICY "Users can view members from their projects" ON project_members
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Insert default roles for existing projects
INSERT INTO project_roles (project_id, name, permissions)
SELECT 
  p.id,
  'Owner',
  '{"all": true}'::jsonb
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM project_roles pr WHERE pr.project_id = p.id AND pr.name = 'Owner'
);

-- Create default roles
CREATE OR REPLACE FUNCTION create_default_project_roles(project_uuid UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO project_roles (project_id, name, permissions) VALUES
    (project_uuid, 'Owner', '{"all": true, "admin": true, "manage_members": true, "manage_polls": true, "manage_roadmap": true}'::jsonb),
    (project_uuid, 'Admin', '{"manage_feedback": true, "manage_polls": true, "manage_roadmap": true, "view_analytics": true}'::jsonb),
    (project_uuid, 'Editor', '{"manage_feedback": true, "manage_polls": true}'::jsonb),
    (project_uuid, 'Viewer', '{"view_feedback": true, "view_polls": true, "vote": true}'::jsonb)
  ON CONFLICT (project_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;