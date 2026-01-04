-- Full-text Search Support
-- Add search vector to feedback_items
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_feedback_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.text, '') || ' ' ||
    COALESCE(NEW.source_url, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS feedback_search_trigger ON feedback_items;
CREATE TRIGGER feedback_search_trigger
BEFORE INSERT OR UPDATE ON feedback_items
FOR EACH ROW
EXECUTE FUNCTION update_feedback_search();

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_feedback_search ON feedback_items USING gin(search_vector);

-- Update existing rows
UPDATE feedback_items SET search_vector = to_tsvector('english', 
  COALESCE(text, '') || ' ' || COALESCE(source_url, '')
);