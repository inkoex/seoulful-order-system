-- Migration: Make legacy category column nullable
-- This allows adding products using the new category_id system without violating the old NOT NULL constraint.

ALTER TABLE products ALTER COLUMN category DROP NOT NULL;
