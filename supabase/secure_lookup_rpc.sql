-- =============================================
-- SECURE LOOKUP RPC
-- =============================================

-- This function allows anon users to search for their orders using ONLY a phone number.
-- It returns a restricted set of data to prevent information leakage.
CREATE OR REPLACE FUNCTION public.search_orders_by_phone(p_phone TEXT)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    delivery_date DATE,
    total_amount NUMERIC,
    status TEXT,
    edit_token UUID,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges, bypassing RLS
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id, 
        o.order_number, 
        o.delivery_date, 
        o.total_amount, 
        o.status, 
        o.edit_token, 
        o.created_at
    FROM public.orders o
    WHERE o.phone = p_phone
      AND o.status != 'cancelled'
    ORDER BY o.delivery_date DESC;
END;
$$;

-- This function allows fetching a single order with token validation.
CREATE OR REPLACE FUNCTION public.get_order_for_edit(p_order_id UUID, p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order JSONB;
BEGIN
    SELECT jsonb_build_object(
        'order', to_jsonb(o.*),
        'items', (
            SELECT jsonb_agg(to_jsonb(oi.*))
            FROM public.order_items oi
            WHERE oi.order_id = o.id
        )
    ) INTO v_order
    FROM public.orders o
    WHERE o.id = p_order_id AND o.edit_token = p_token;

    RETURN v_order;
END;
$$;

-- This function allows updating an order with token validation.
CREATE OR REPLACE FUNCTION public.update_order_with_token(
    p_order_id UUID, 
    p_token UUID, 
    p_delivery_date TEXT, 
    p_notes TEXT,
    p_subtotal NUMERIC,
    p_delivery_fee NUMERIC,
    p_total_amount NUMERIC,
    p_items JSONB -- Array of items to replace existing ones
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Validate token and lock status
    SELECT count(*) INTO v_count
    FROM public.orders
    WHERE id = p_order_id AND edit_token = p_token AND is_locked = false;

    IF v_count = 0 THEN
        RETURN FALSE;
    END IF;

    -- Update order
    UPDATE public.orders
    SET 
        delivery_date = p_delivery_date::DATE,
        notes = p_notes,
        subtotal = p_subtotal,
        delivery_fee = p_delivery_fee,
        total_amount = p_total_amount,
        updated_at = now()
    WHERE id = p_order_id;

    -- Update items (delete and re-insert)
    DELETE FROM public.order_items WHERE order_id = p_order_id;
    
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, subtotal)
    SELECT 
        p_order_id, 
        (val->>'product_id')::UUID, 
        (val->>'quantity')::INTEGER, 
        (val->>'unit_price')::NUMERIC, 
        (val->>'subtotal')::NUMERIC
    FROM jsonb_array_elements(p_items) AS val;

    RETURN TRUE;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_order_for_edit(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_for_edit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_with_token(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.update_order_with_token(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, JSONB) TO authenticated;
