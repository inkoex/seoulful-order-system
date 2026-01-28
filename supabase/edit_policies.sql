-- RLS Policies for Order Edit and Lookup Features
-- Created: 2026-01-25

-- Allow update orders (if not locked)
CREATE POLICY "Allow update orders" ON orders
  FOR UPDATE
  TO anon, authenticated
  USING (is_locked = false);

-- Allow delete order_items (for edit flow)
CREATE POLICY "Allow delete order_items" ON order_items
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Enable RLS on order_history
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert order_history" ON order_history
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow read order_history" ON order_history
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_order_history_order_id
  ON order_history(order_id);
