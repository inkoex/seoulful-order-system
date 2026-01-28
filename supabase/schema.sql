-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL, -- Format: ORD-YYMMDD-XXX (Handled by Trigger/Function ideally, or App)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  apartment TEXT NOT NULL,
  tower TEXT NOT NULL,
  flat_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  delivery_date DATE NOT NULL,
  payment_method TEXT NOT NULL, -- 'upi', 'cash', 'other'
  notes TEXT,
  
  entry_channel TEXT DEFAULT 'customer_direct', -- 'customer_direct', 'admin_whatsapp', etc.
  edit_token UUID DEFAULT uuid_generate_v4(), -- Token for anonymous editing
  is_locked BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'received', -- 'received', 'ready', 'delivered', 'paid', 'cancelled'
  
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_reason TEXT,
  original_order_id UUID, -- For tracking edits if we create new rows (optional, or just update)
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0
);

-- 2. Products Table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ko TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- 3. Order Items Table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL
);

-- 4. Order History Table
CREATE TABLE order_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  changed_fields JSONB NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  changed_by TEXT -- 'customer' or 'admin'
);

-- 5. Sync Failures Table
CREATE TABLE sync_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  retried_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_delivery_date_status ON orders(delivery_date, status);
CREATE INDEX idx_orders_phone ON orders(phone);
CREATE INDEX idx_orders_edit_token ON orders(edit_token);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- RLS Policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read products
CREATE POLICY "Public can view active products" ON products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Public can insert orders (Anonymous submission)
CREATE POLICY "Allow anonymous insert orders" ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous insert order items" ON order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow reading orders and items (for confirmation page)
CREATE POLICY "Allow read own order" ON orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow read order items" ON order_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Seed Data (Products)
INSERT INTO products (name, name_ko, category, price, sort_order) VALUES
('Salt Bread', '소금빵', 'bread', 100, 1),
('Kkwabaegi', '꽈배기', 'bread', 80, 2),
('Plain Bread', '식빵 (플레인)', 'bread', 150, 3),
('Choco Bread', '식빵 (초코)', 'bread', 180, 4),
('Plain Scone', '스콘 (플레인)', 'scone', 120, 5),
('Cranberry Scone', '스콘 (크랜베리)', 'scone', 130, 6);

-- View: Order Details (주문 상세 내역)
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
  p.category AS product_category,
  oi.quantity,
  oi.unit_price,
  oi.subtotal
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
ORDER BY o.created_at DESC, oi.id;
