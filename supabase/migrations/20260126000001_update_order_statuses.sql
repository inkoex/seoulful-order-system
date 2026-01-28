-- Update order statuses to new workflow

ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'received';

UPDATE orders
SET status = 'received'
WHERE status IN ('pending', 'confirmed');

UPDATE orders
SET status = 'paid'
WHERE status = 'completed';
