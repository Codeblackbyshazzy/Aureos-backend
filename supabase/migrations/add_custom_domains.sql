-- Custom Domain Support
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS domain_verification_token VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS domain_verified_at TIMESTAMP;

-- Index
CREATE INDEX IF NOT EXISTS idx_projects_domain ON projects(custom_domain);

-- Add check constraint for custom domain format
ALTER TABLE projects ADD CONSTRAINT valid_custom_domain 
CHECK (custom_domain IS NULL OR custom_domain ~ '^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$');