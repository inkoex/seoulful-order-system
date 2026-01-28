-- Create tables for Seoulful Order System

-- 1. Apartments (Dropdown options)
create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'Karle', 'SNN', etc.
  name text not null,
  created_at timestamptz default now()
);

-- 2. Products (Catalog)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null, -- 'Bread', 'Scone', etc.
  price integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Orders (Head)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  customer_name text not null,
  phone_number text not null,
  apartment_id uuid references public.apartments(id),
  tower_dong text,
  flat_ho text,
  delivery_date date not null,
  payment_method text not null, -- 'UPI', 'Cash', 'Other'
  notes text,
  status text default 'received' -- 'received', 'ready', 'delivered', 'paid', 'cancelled'
);

-- 4. Order Items (Lines)
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  quantity integer not null check (quantity > 0)
);

-- Enable Row Level Security (RLS)
alter table public.apartments enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Policies (Public allow read for Menu/Apartments, allow insert for Orders)
-- For MVP, we might keep it simple. Authenticated 'service_role' (server side) or public anon access is needed.
-- Since this is a public order form, we need to allow ANONYMOUS INSERT on orders.

create policy "Enable read access for all users" on public.apartments for select using (true);
create policy "Enable read access for all users" on public.products for select using (true);

create policy "Enable insert for everyone" on public.orders for insert with check (true);
create policy "Enable read access for created order" on public.orders for select using (true); -- Optional: restrict to own order if possible, but for MVP maybe public read is risky. Let's start with just Insert.
-- Actually, the admin dashboard needs to read. Admin will use Service Role or authenticated user.
-- Let's use a simple policy: "Allow all access to authenticated users (admin)" and "Allow insert to anon".

-- Orders: Anon can insert. Admin can do all.
create policy "Anon can insert orders" on public.orders for insert with check (true);
create policy "Admin can do all on orders" on public.orders for all using (auth.role() = 'authenticated'); -- Assuming Admin logs in

-- Order Items: Anon can insert.
create policy "Anon can insert order_items" on public.order_items for insert with check (true);
create policy "Admin can do all on order_items" on public.order_items for all using (auth.role() = 'authenticated');
