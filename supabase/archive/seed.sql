-- Seed Data

-- Apartments
insert into public.apartments (code, name) values
('Karle', 'Karle Town Centre'),
('SNN', 'SNN Raj Spirit'),
('ELT', 'Elita Promenade'),
('RMZ', 'RMZ Galleria'),
('Brigade', 'Brigade Metropolis'),
('Other', 'Other');

-- Products
insert into public.products (name, category, price, is_active) values
('Salt Bread', 'Bread', 0, true),
('Twisted Donut', 'Donut', 0, true),
('Bread (Plain)', 'Bread', 0, true),
('Bread (Choco)', 'Bread', 0, true),
('Scone', 'Scone', 0, true);
