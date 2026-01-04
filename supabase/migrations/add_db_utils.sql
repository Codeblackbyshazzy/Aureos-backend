-- Atomic increment function
CREATE OR REPLACE FUNCTION increment(table_name TEXT, row_id UUID, column_name TEXT, amount INT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET %I = COALESCE(%I, 0) + $1 WHERE id = $2', table_name, column_name, column_name)
  USING amount, row_id;
END;
$$ LANGUAGE plpgsql;

-- Batch increment function
CREATE OR REPLACE FUNCTION increment_counters(table_name TEXT, row_ids UUID[], column_name TEXT, amount INT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET %I = COALESCE(%I, 0) + $1 WHERE id = ANY($2)', table_name, column_name, column_name)
  USING amount, row_ids;
END;
$$ LANGUAGE plpgsql;
