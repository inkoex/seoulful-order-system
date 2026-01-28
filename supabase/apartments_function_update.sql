-- =============================================
-- Update create_order_with_items for apartment_id
-- =============================================
-- Run AFTER apartments_migration.sql
-- This updates the function to accept apartment_id (UUID) instead of apartment (TEXT)

CREATE OR REPLACE FUNCTION create_order_with_items(
    p_apartment_id UUID,              -- CHANGED: UUID instead of TEXT
    p_tower TEXT,
    p_flat_number TEXT,
    p_customer_name TEXT,
    p_phone TEXT,
    p_delivery_date DATE,
    p_payment_method TEXT,
    p_notes TEXT,
    p_entry_channel TEXT,
    p_items JSONB  -- Array of {product_id, quantity}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC := 0;
    v_item JSONB;
    v_product RECORD;
    v_edit_token UUID;
    v_apartment_name TEXT;  -- For backward compat with TEXT column
BEGIN
    -- Validate apartment exists and is active
    SELECT name INTO v_apartment_name
    FROM apartments
    WHERE id = p_apartment_id
    AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Apartment not found or inactive: %', p_apartment_id;
    END IF;

    -- Generate order number atomically
    v_order_number := generate_order_number();

    -- Generate edit token
    v_edit_token := gen_random_uuid();

    -- Calculate total amount from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Get product price
        SELECT id, price INTO v_product
        FROM products
        WHERE id = (v_item->>'product_id')::UUID
        AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found or inactive: %', v_item->>'product_id';
        END IF;

        -- Add to total
        v_total_amount := v_total_amount + (v_product.price * (v_item->>'quantity')::INTEGER);
    END LOOP;

    -- Insert order
    INSERT INTO orders (
        order_number,
        apartment,          -- Keep TEXT column for backward compat
        apartment_id,       -- NEW: FK to apartments table
        tower,
        flat_number,
        customer_name,
        phone,
        delivery_date,
        payment_method,
        notes,
        entry_channel,
        status,
        total_amount,
        edit_token,
        is_locked
    ) VALUES (
        v_order_number,
        v_apartment_name,   -- Populate TEXT column from apartment name
        p_apartment_id,     -- NEW: Store FK relationship
        p_tower,
        p_flat_number,
        p_customer_name,
        p_phone,
        p_delivery_date,
        p_payment_method,
        p_notes,
        p_entry_channel,
        'received',
        v_total_amount,
        v_edit_token,
        false
    )
    RETURNING id INTO v_order_id;

    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Skip items with 0 quantity
        IF (v_item->>'quantity')::INTEGER > 0 THEN
            -- Get product info again for unit_price
            SELECT price INTO v_product
            FROM products
            WHERE id = (v_item->>'product_id')::UUID;

            INSERT INTO order_items (
                order_id,
                product_id,
                quantity,
                unit_price,
                subtotal
            ) VALUES (
                v_order_id,
                (v_item->>'product_id')::UUID,
                (v_item->>'quantity')::INTEGER,
                v_product.price,
                v_product.price * (v_item->>'quantity')::INTEGER
            );
        END IF;
    END LOOP;

    -- Return order details
    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'edit_token', v_edit_token,
        'total_amount', v_total_amount
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;

-- =============================================
-- Grant Execute Permissions
-- =============================================

-- Allow anon users to call create_order_with_items (for customer orders)
GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- =============================================
-- Documentation
-- =============================================

COMMENT ON FUNCTION create_order_with_items(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, JSONB) IS
'Transactionally creates an order with items using apartment_id FK.
First parameter is now apartment_id (UUID) instead of apartment name (TEXT).
Validates apartment is active, products exist, calculates totals, and ensures atomicity.
Maintains backward compatibility by populating both apartment (TEXT) and apartment_id (UUID) columns.
Example: SELECT create_order_with_items(
    ''uuid-of-apartment''::uuid, ''A'', ''101'', ''John'', ''9876543210'',
    ''2024-01-20''::date, ''upi'', ''Notes'', ''customer_direct'',
    ''[{"product_id": "uuid-here", "quantity": 2}]''::jsonb
);';
