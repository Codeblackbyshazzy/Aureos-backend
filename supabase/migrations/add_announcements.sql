-- Announcement categories
CREATE TABLE announcement_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES announcement_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED,
  CONSTRAINT announcements_scheduled_requires_time CHECK ((status <> 'scheduled') OR (scheduled_for IS NOT NULL)),
  CONSTRAINT announcements_published_requires_time CHECK ((status <> 'published') OR (published_at IS NOT NULL))
);

-- Subscribers
CREATE TABLE announcement_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(project_id, user_id)
);

-- Reads
CREATE TABLE announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Indexes
CREATE INDEX idx_announcement_categories_project ON announcement_categories(project_id);

CREATE INDEX idx_announcements_project_status_published_at
  ON announcements(project_id, status, published_at);
CREATE INDEX idx_announcements_project_scheduled_for
  ON announcements(project_id, scheduled_for);
CREATE INDEX idx_announcements_search_vector
  ON announcements USING GIN (search_vector);

CREATE INDEX idx_announcement_subscribers_project
  ON announcement_subscribers(project_id);

CREATE INDEX idx_announcement_reads_announcement
  ON announcement_reads(announcement_id);
CREATE INDEX idx_announcement_reads_read_at
  ON announcement_reads(read_at);

-- Enable RLS
ALTER TABLE announcement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Categories: project owners or subscribers can view
CREATE POLICY "View announcement categories" ON announcement_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = announcement_categories.project_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM announcement_subscribers s
      WHERE s.project_id = announcement_categories.project_id
        AND s.user_id = auth.uid()
        AND s.unsubscribed_at IS NULL
    )
  );

CREATE POLICY "Project owners can manage announcement categories" ON announcement_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = announcement_categories.project_id AND p.user_id = auth.uid()
    )
  );

-- Announcements: project owners can manage; subscribers can view published
CREATE POLICY "View announcements" ON announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = announcements.project_id AND p.user_id = auth.uid()
    )
    OR (
      announcements.status = 'published'
      AND EXISTS (
        SELECT 1 FROM announcement_subscribers s
        WHERE s.project_id = announcements.project_id
          AND s.user_id = auth.uid()
          AND s.unsubscribed_at IS NULL
      )
    )
  );

CREATE POLICY "Project owners can manage announcements" ON announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = announcements.project_id AND p.user_id = auth.uid()
    )
  );

-- Subscribers
CREATE POLICY "Users can view their announcement subscriptions" ON announcement_subscribers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their announcement subscriptions" ON announcement_subscribers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their announcement subscriptions" ON announcement_subscribers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Project owners can view subscribers" ON announcement_subscribers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = announcement_subscribers.project_id AND p.user_id = auth.uid()
    )
  );

-- Reads
CREATE POLICY "Users can create their reads" ON announcement_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their reads" ON announcement_reads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Project owners can view announcement reads" ON announcement_reads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM announcements a
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = announcement_reads.announcement_id
        AND p.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_announcement_categories_updated_at BEFORE UPDATE ON announcement_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
