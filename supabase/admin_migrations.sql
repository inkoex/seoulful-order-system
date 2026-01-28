-- Admin System Database Migrations
-- Run this after schema.sql

-- 1. Extend products table with additional fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Extend orders table with admin notes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 3. RLS Policies for admin operations on products
-- Allow UPDATE on products
CREATE POLICY "Admin can update products" ON products
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Allow INSERT on products
CREATE POLICY "Admin can insert products" ON products
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow DELETE on products
CREATE POLICY "Admin can delete products" ON products
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- 4. Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Trigger to auto-update updated_at on products table
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Trigger to auto-update updated_at on orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
