-- ============================================================================
-- Secure order edit RPC (additive — safe to apply anytime)
-- ----------------------------------------------------------------------------
-- Adds a NEW overload of update_order_with_token with server-authoritative
-- pricing, atomic notice-limit enforcement, and product validation. History is
-- written by the app (detailed field-level diff), so this RPC does not.
--
-- This is ADDITIVE: it does not drop the old update_order_with_token overload or
-- the legacy lookup RPCs, so the currently deployed app and the new app both keep
-- working. No deploy-timing coordination needed — push the app whenever.
--
-- The legacy functions are removed later by 20260706000003_drop_legacy_order_rpcs
-- once the new app is confirmed live.
--
-- Depends on enforce_notice_limits from part 1 (20260706000000).
-- Callable by service_role only (the app calls it via the service key).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_order_with_token(
    p_order_id UUID,
    p_token UUID,
    p_delivery_date TEXT,
    p_notes TEXT,
    p_items JSONB,
    p_notice_id UUID DEFAULT NULL,
    p_changed_by TEXT DEFAULT 'customer'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_subtotal NUMERIC := 0;
    v_delivery_fee NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_item JSONB;
    v_pid UUID;
    v_qty INTEGER;
    v_price NUMERIC;
BEGIN
    -- Validate token, lock the order row.
    SELECT id, is_locked INTO v_order
      FROM orders
     WHERE id = p_order_id AND edit_token = p_token
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'INVALID_TOKEN');
    END IF;
    IF v_order.is_locked THEN
        RETURN jsonb_build_object('success', false, 'reason', 'LOCKED');
    END IF;

    -- Enforce limits, excluding this order's current items so a reduction frees
    -- capacity instead of double-counting.
    IF p_notice_id IS NOT NULL THEN
        PERFORM public.enforce_notice_limits(p_notice_id, p_items, p_order_id);
    END IF;

    -- Server-authoritative pricing + product validation.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        IF v_qty <= 0 THEN CONTINUE; END IF;
        v_pid := (v_item->>'product_id')::UUID;

        SELECT price INTO v_price FROM products WHERE id = v_pid;
        IF v_price IS NULL THEN
            RAISE EXCEPTION 'Product not found: %', v_pid;
        END IF;

        -- Allow active products, or products already in this order (so a product
        -- deactivated after ordering can remain, but new inactive ones can't be added).
        IF NOT (
            EXISTS (SELECT 1 FROM products WHERE id = v_pid AND is_active = true)
            OR EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id AND product_id = v_pid)
        ) THEN
            RAISE EXCEPTION 'Product not orderable: %', v_pid;
        END IF;

        v_subtotal := v_subtotal + (v_price * v_qty);
    END LOOP;

    IF v_subtotal <= 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    v_delivery_fee := CASE WHEN v_subtotal > 0 AND v_subtotal < 500 THEN 30 ELSE 0 END;
    v_total_amount := v_subtotal + v_delivery_fee;

    UPDATE orders SET
        delivery_date = p_delivery_date::DATE,
        notes = p_notes,
        subtotal = v_subtotal,
        delivery_fee = v_delivery_fee,
        total_amount = v_total_amount,
        updated_at = now()
    WHERE id = p_order_id;

    DELETE FROM order_items WHERE order_id = p_order_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        IF v_qty <= 0 THEN CONTINUE; END IF;
        v_pid := (v_item->>'product_id')::UUID;
        SELECT price INTO v_price FROM products WHERE id = v_pid;
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (p_order_id, v_pid, v_qty, v_price, v_price * v_qty);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'subtotal', v_subtotal,
        'delivery_fee', v_delivery_fee,
        'total_amount', v_total_amount
    );
END;
$$;

-- The app calls this via the service role only. Deny anon/authenticated/PUBLIC.
REVOKE ALL ON FUNCTION public.update_order_with_token(
    uuid,uuid,text,text,jsonb,uuid,text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_with_token(
    uuid,uuid,text,text,jsonb,uuid,text
) TO service_role;
