-- Apartments Management Migration
-- Run this migration to add apartment management feature
-- Safe for production: includes data migration and rollback steps

-- =============================================
-- 1. CREATE APARTMENTS TABLE
-- =============================================

CREATE TABLE apartments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,           -- 영문 이름 (e.g., 'Karle', 'SNN')
  name_ko TEXT NOT NULL,               -- 한글 이름 (e.g., '칼레', '기타')
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- 2. CREATE INDEX
-- =============================================

CREATE INDEX idx_apartments_sort_order ON apartments(sort_order);

-- =============================================
-- 3. ENABLE RLS
-- =============================================

ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. RLS POLICIES
-- =============================================

-- Public can view active apartments (for order forms)
CREATE POLICY "Public can view active apartments" ON apartments
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Admin can view all apartments (including inactive)
CREATE POLICY "Admin can view all apartments" ON apartments
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admin can insert apartments
CREATE POLICY "Admin can insert apartments" ON apartments
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Admin can update apartments
CREATE POLICY "Admin can update apartments" ON apartments
  FOR UPDATE TO anon, authenticated
  USING (true);

-- Admin can delete apartments
CREATE POLICY "Admin can delete apartments" ON apartments
  FOR DELETE TO anon, authenticated
  USING (true);

-- =============================================
-- 5. SEED INITIAL APARTMENTS
-- =============================================
-- Seed with existing hardcoded values from order forms

INSERT INTO apartments (name, name_ko, sort_order, is_active) VALUES
('Karle', '칼레', 1, true),
('SNN', 'SNN', 2, true),
('ELT', 'ELT', 3, true),
('RMZ', 'RMZ', 4, true),
('Brigade', '브리게이드', 5, true),
('Other', '기타', 99, true);

-- =============================================
-- 6. ADD APARTMENT_ID FK TO ORDERS TABLE
-- =============================================
-- Add nullable initially for safe migration

ALTER TABLE orders ADD COLUMN apartment_id UUID REFERENCES apartments(id);

-- =============================================
-- 7. MIGRATE EXISTING DATA
-- =============================================
-- Map TEXT apartment values to apartment_id

UPDATE orders o
SET apartment_id = a.id
FROM apartments a
WHERE o.apartment = a.name;

-- =============================================
-- 8. HANDLE UNMAPPED DATA
-- =============================================
-- Check for any orders that didn't match
-- If there are unmapped orders, map them to 'Other'

UPDATE orders o
SET apartment_id = (SELECT id FROM apartments WHERE name = 'Other')
WHERE apartment_id IS NULL;

-- =============================================
-- 9. CREATE INDEX ON FK
-- =============================================

CREATE INDEX idx_orders_apartment_id ON orders(apartment_id);

-- =============================================
-- 10. UPDATE ORDER_DETAILS_VIEW
-- =============================================
-- Add apartment information to existing view

DROP VIEW IF EXISTS order_details_view;

CREATE OR REPLACE VIEW order_details_view AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.created_at,
  o.delivery_date,
  o.apartment,                         -- Keep TEXT column for backward compat
  apt.name AS apartment_name,          -- New: from apartments table
  apt.name_ko AS apartment_name_ko,    -- New: Korean name
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
LEFT JOIN apartments apt ON o.apartment_id = apt.id
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY o.created_at DESC, oi.id;

-- =============================================
-- 11. OPTIONAL: MAKE apartment_id NOT NULL
-- =============================================
-- Run this AFTER verifying migration and updating create_order_with_items function
-- ALTER TABLE orders ALTER COLUMN apartment_id SET NOT NULL;

-- =============================================
-- 12. COMMENTS
-- =============================================

COMMENT ON TABLE apartments IS 'Apartment/building complexes for delivery addresses';
COMMENT ON COLUMN apartments.name IS 'English/code name (e.g., Karle, SNN)';
COMMENT ON COLUMN apartments.name_ko IS 'Korean display name (e.g., 칼레, 기타)';
COMMENT ON COLUMN apartments.sort_order IS 'Display order in dropdowns (lower = first)';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- Next steps:
-- 1. Update create_order_with_items function to use apartment_id
-- 2. Update order forms to load from apartments table
-- 3. Create admin management routes
-- 4. Test thoroughly before making apartment_id NOT NULL
