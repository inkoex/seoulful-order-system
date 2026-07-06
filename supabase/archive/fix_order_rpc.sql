-- update create_order_with_items RPC function
-- Change p_apartment (TEXT) to p_apartment_id (UUID) and update internal logic

-- First drop the old versions to avoid ambiguity
DROP FUNCTION IF EXISTS create_order_with_items(text,text,text,text,text,date,text,text,text,jsonb);
DROP FUNCTION IF EXISTS create_order_with_items(uuid,text,text,text,text,date,text,text,text,jsonb);

CREATE OR REPLACE FUNCTION create_order_with_items(
    p_apartment_id UUID,
    p_tower TEXT,
    p_flat_number TEXT,
    p_customer_name TEXT,
    p_phone TEXT,
    p_delivery_date DATE,
    p_payment_method TEXT,
    p_notes TEXT,
    p_entry_channel TEXT,
    p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total_amount NUMERIC := 0;
    v_item JSONB;
    v_product RECORD;
    v_edit_token UUID;
    v_apartment_name TEXT;
BEGIN
    -- Get apartment name for backward compatibility in orders.apartment column
    SELECT name INTO v_apartment_name FROM apartments WHERE id = p_apartment_id;

    -- Generate order number atomically
    v_order_number := generate_order_number();

    -- Generate edit token
    v_edit_token := gen_random_uuid();

    -- Calculate total amount from items to store in the order record
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Get product price and ensure it's active
        SELECT price INTO v_product
        FROM products
        WHERE id = (v_item->>'product_id')::UUID
        AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found or inactive: %', v_item->>'product_id';
        END IF;

        -- Add to running total
        v_total_amount := v_total_amount + (v_product.price * (v_item->>'quantity')::INTEGER);
    END LOOP;

    -- Insert order
    INSERT INTO orders (
        order_number,
        apartment_id,
        apartment, -- Keep text version for backward compatibility
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
        p_apartment_id,
        v_apartment_name,
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
        -- Only insert items with positive quantity
        IF (v_item->>'quantity')::INTEGER > 0 THEN
            -- Get latest price for the item record
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
                (v_product.price * (v_item->>'quantity')::INTEGER)
            );
        END IF;
    END LOOP;

    -- Return the result
    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'edit_token', v_edit_token,
        'total_amount', v_total_amount
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION create_order_with_items TO anon, authenticated;
