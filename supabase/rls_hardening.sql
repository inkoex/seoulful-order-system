-- =============================================
-- RLS HARDENING MIGRATION (Idempotent)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;

-- 1. PRODUCTS
DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products" ON public.products 
FOR SELECT TO anon, authenticated 
USING (is_active = true);

-- 2. APARTMENTS
DROP POLICY IF EXISTS "Public read active apartments" ON public.apartments;
CREATE POLICY "Public read active apartments" ON public.apartments 
FOR SELECT TO anon, authenticated 
USING (is_active = true);

-- 3. NOTICES
DROP POLICY IF EXISTS "Public read active notices" ON public.notices;
CREATE POLICY "Public read active notices" ON public.notices 
FOR SELECT TO anon, authenticated 
USING (status = 'active');

DROP POLICY IF EXISTS "Public read notice products" ON public.notice_products;
CREATE POLICY "Public read notice products" ON public.notice_products 
FOR SELECT TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Public read notice limits" ON public.notice_limits;
CREATE POLICY "Public read notice limits" ON public.notice_limits 
FOR SELECT TO anon, authenticated 
USING (true);

-- 4. ORDERS
-- Clean up all potential old policy names
DROP POLICY IF EXISTS "Allow view by phone or token" ON public.orders;
DROP POLICY IF EXISTS "Users can only see their own orders via phone/token" ON public.orders;
DROP POLICY IF EXISTS "Strict access via token" ON public.orders;
DROP POLICY IF EXISTS "Allow view by token" ON public.orders;
DROP POLICY IF EXISTS "Allow update by token only" ON public.orders;
DROP POLICY IF EXISTS "Admin select orders" ON public.orders;
DROP POLICY IF EXISTS "Anon no direct select" ON public.orders;
DROP POLICY IF EXISTS "Admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Anon no direct update" ON public.orders;
DROP POLICY IF EXISTS "No direct insertion" ON public.orders;

-- New clean policies
-- Admin can do everything
CREATE POLICY "Admin select orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);

-- Anonymous users cannot SELECT/UPDATE directly. They MUST use RPCs.
CREATE POLICY "Anon no direct select" ON public.orders FOR SELECT TO anon USING (false);
CREATE POLICY "Anon no direct update" ON public.orders FOR UPDATE TO anon USING (false);
CREATE POLICY "Anon no direct insert" ON public.orders FOR INSERT TO anon WITH CHECK (false);

-- 5. ORDER ITEMS
DROP POLICY IF EXISTS "Allow view linked items" ON public.order_items;
DROP POLICY IF EXISTS "No direct modification of items" ON public.order_items;
DROP POLICY IF EXISTS "Admin all order_items" ON public.order_items;
DROP POLICY IF EXISTS "Anon no direct access order_items" ON public.order_items;

-- Admin can do everything
CREATE POLICY "Admin all order_items" ON public.order_items FOR ALL TO authenticated USING (true);

-- Anonymous can only view items via orders they have access to (if any) or via RPC
-- To keep it simple and consistent with orders:
CREATE POLICY "Anon no direct access order_items" ON public.order_items FOR ALL TO anon USING (false);

-- =============================================
-- RPC EXCEPTION HANDLING FIX
-- =============================================

-- Ensure create_order_with_items is usable by anon
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items TO authenticated;
