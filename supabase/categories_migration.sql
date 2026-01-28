-- Categories Migration
-- Run this migration AFTER the initial schema.sql

-- 1. Create Categories Table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,           -- 영문 이름 (e.g., 'bread')
  name_ko TEXT NOT NULL,               -- 한글 이름 (e.g., '빵')
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public can view active categories
CREATE POLICY "Public can view active categories" ON categories
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Admin can view all categories (including inactive)
CREATE POLICY "Admin can view all categories" ON categories
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admin can insert categories
CREATE POLICY "Admin can insert categories" ON categories
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Admin can update categories
CREATE POLICY "Admin can update categories" ON categories
  FOR UPDATE TO anon, authenticated
  USING (true);

-- Admin can delete categories
CREATE POLICY "Admin can delete categories" ON categories
  FOR DELETE TO anon, authenticated
  USING (true);

-- 2. Seed initial categories (from existing product categories)
INSERT INTO categories (name, name_ko, sort_order) VALUES
('bread', '빵', 1),
('scone', '스콘', 2),
('other', '기타', 99);

-- 3. Add category_id column to products
ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id);

-- 4. Migrate existing data
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE p.category = c.name;

-- 5. Make category_id NOT NULL after migration (optional, run after verifying migration)
-- ALTER TABLE products ALTER COLUMN category_id SET NOT NULL;

-- 6. Create index on category_id
CREATE INDEX idx_products_category_id ON products(category_id);

-- 7. Update the order_details_view to include category info
DROP VIEW IF EXISTS order_details_view;

CREATE OR REPLACE VIEW order_details_view AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.created_at,
  o.delivery_date,
  o.apartment,
  o.tower,
  o.flat_number,
  o.customer_name,
  o.phone,
  o.payment_method,
  o.notes,
  o.status,
  o.total_amount,
  o.is_locked,
  oi.id AS item_id,
  p.name AS product_name,
  p.name_ko AS product_name_ko,
  c.name AS product_category,
  c.name_ko AS product_category_ko,
  oi.quantity,
  oi.unit_price,
  oi.subtotal
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY o.created_at DESC, oi.id;
