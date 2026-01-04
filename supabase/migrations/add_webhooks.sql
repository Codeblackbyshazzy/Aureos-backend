CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_subscriptions (
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  PRIMARY KEY (webhook_id, event_id)
);

CREATE TABLE webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempt INT NOT NULL DEFAULT 1,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_project ON webhooks(project_id);
CREATE INDEX idx_webhook_subscriptions_event ON webhook_subscriptions(event_id);
CREATE INDEX idx_webhook_delivery_logs_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_delivery_logs_created_at ON webhook_delivery_logs(created_at);
CREATE INDEX idx_webhook_delivery_logs_event_name ON webhook_delivery_logs(event_name);
CREATE INDEX idx_webhook_delivery_logs_next_retry_at ON webhook_delivery_logs(next_retry_at);

-- Seed event types
INSERT INTO webhook_events (name, description) VALUES
  ('feedback.created', 'A feedback item was created'),
  ('feedback.updated', 'A feedback item was updated'),
  ('cluster.updated', 'A feedback cluster was updated'),
  ('announcement.published', 'An announcement was published'),
  ('roadmap.updated', 'A roadmap item was updated')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view webhook events" ON webhook_events
  FOR SELECT USING (true);

CREATE POLICY "Project owners can manage webhooks" ON webhooks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = webhooks.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage webhook subscriptions" ON webhook_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM webhooks w
      JOIN projects p ON w.project_id = p.id
      WHERE w.id = webhook_subscriptions.webhook_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can view webhook delivery logs" ON webhook_delivery_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webhooks w
      JOIN projects p ON w.project_id = p.id
      WHERE w.id = webhook_delivery_logs.webhook_id AND p.user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
