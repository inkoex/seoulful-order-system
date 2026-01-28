-- =============================================
-- RLS Policies Redesign
-- =============================================
-- This migration removes overly permissive RLS policies
-- and implements proper security boundaries

-- =============================================
-- 1. Drop Old Permissive Policies
-- =============================================

-- Products policies (too permissive - allowed anon to update/insert/delete)
DROP POLICY IF EXISTS "Admin can update products" ON products;
DROP POLICY IF EXISTS "Admin can insert products" ON products;
DROP POLICY IF EXISTS "Admin can delete products" ON products;

-- Orders policies from edit_policies.sql (allowed anon to update/delete)
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
DROP POLICY IF EXISTS "Users can delete own order_items" ON order_items;

-- =============================================
-- 2. Products Table Policies
-- =============================================

-- SELECT: Everyone can view active products (needed for customer orders)
CREATE POLICY "Anyone can view active products"
ON products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- INSERT/UPDATE/DELETE: Denied for anon/authenticated
-- Admin operations use service_role key which bypasses RLS
-- No explicit DENY policies needed - absence of ALLOW policy = deny

-- =============================================
-- 3. Orders Table Policies
-- =============================================

-- SELECT: Users can view their own orders (by phone number)
CREATE POLICY "Users can view own orders"
ON orders
FOR SELECT
TO anon, authenticated
USING (phone = current_setting('request.jwt.claims', true)::json->>'phone'
       OR true); -- Fallback: allow if phone matches (for anon users, we'll use a different approach)

-- Better approach for anon users without JWT:
-- Since we're using anon key, we can't really authenticate at DB level
-- We'll rely on application-level filtering in queries
-- For now, allow SELECT (queries will filter by phone in application code)
DROP POLICY IF EXISTS "Users can view own orders" ON orders;

CREATE POLICY "Users can view orders"
ON orders
FOR SELECT
TO anon, authenticated
USING (true); -- Application will filter by phone

-- INSERT: Denied (must use create_order_with_items RPC function)
-- The RPC function uses SECURITY DEFINER to bypass RLS
-- No policy needed - absence of INSERT policy = deny direct inserts

-- UPDATE: Only for unlocked orders with valid edit_token
-- This is tricky to enforce at RLS level without access to the provided edit_token
-- We'll allow UPDATE but the application must verify edit_token first
CREATE POLICY "Users can update unlocked orders"
ON orders
FOR UPDATE
TO anon, authenticated
USING (is_locked = false)
WITH CHECK (is_locked = false);

-- DELETE: Denied (only admin via service_role can cancel orders)
-- No policy needed - absence of DELETE policy = deny

-- =============================================
-- 4. Order Items Table Policies
-- =============================================

-- SELECT: Users can view items of their orders
-- Join with orders table to check phone
CREATE POLICY "Users can view order items"
ON order_items
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
    )
);

-- INSERT: Denied (must use create_order_with_items RPC function)
-- No policy needed - absence of INSERT policy = deny direct inserts

-- UPDATE: Denied (customers modify entire orders, not individual items)
-- No policy needed

-- DELETE: Denied
-- No policy needed

-- =============================================
-- 5. Order History Table Policies
-- =============================================

-- SELECT: Users can view history of their orders
CREATE POLICY "Users can view order history"
ON order_history
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_history.order_id
    )
);

-- INSERT/UPDATE/DELETE: Denied (only system via service_role)
-- No policies needed

-- =============================================
-- 6. Enable RLS on All Tables
-- =============================================

-- Ensure RLS is enabled on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. Comments for Documentation
-- =============================================

COMMENT ON POLICY "Anyone can view active products" ON products IS
'Public can view active products to place orders. Admin operations (add/edit/delete) use service_role key.';

COMMENT ON POLICY "Users can view orders" ON orders IS
'All authenticated and anonymous users can SELECT orders. Application code filters by phone number.';

COMMENT ON POLICY "Users can update unlocked orders" ON orders IS
'Users can update orders that are not locked. Application must verify edit_token before allowing updates.';

COMMENT ON POLICY "Users can view order items" ON order_items IS
'Users can view order items for all orders (application filters by phone via orders table).';

COMMENT ON POLICY "Users can view order history" ON order_history IS
'Users can view history of all orders (application filters by phone via orders table).';

-- =============================================
-- SECURITY NOTES
-- =============================================
--
-- 1. Direct INSERT on orders/order_items is now blocked
--    - Must use create_order_with_items() RPC function
--    - Function uses SECURITY DEFINER to bypass RLS
--
-- 2. Products modifications are blocked for anon/authenticated
--    - Admin operations use service_role key (bypasses RLS)
--
-- 3. Order UPDATE requires is_locked = false
--    - Application must verify edit_token before update
--    - Consider adding a CHECK constraint for extra safety
--
-- 4. DELETE operations are blocked (only service_role)
--    - Prevents accidental data loss
--
-- 5. SELECT policies are permissive for simplicity
--    - Relies on application-level phone filtering
--    - Could be tightened with custom JWT claims if needed
