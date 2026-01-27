-- Add is_nps field to surveys table for NPS survey support
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS is_nps BOOLEAN DEFAULT false;