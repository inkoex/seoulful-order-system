-- ============================================================================
-- Atomic order pricing + notice-limit enforcement
-- ----------------------------------------------------------------------------
-- Moves delivery-fee pricing and notice quantity limits INTO the database so
-- that create and edit share one race-free source of truth.
--
--   * create_order_with_items  : adds delivery fee, writes subtotal/delivery_fee,
--                                enforces notice limits atomically
--   * update_order_with_token  : recomputes price server-side (ignores client
--                                totals), enforces limits, writes order_history
--   * enforce_notice_limits    : shared helper; locks the notice row and checks
--                                total + per-product caps against live usage
--
-- Delivery fee rule mirrors app/utils/order.ts: subtotal in (0, 500) -> 30 else 0.
-- Usage window mirrors app/lib/notices.server.ts: orders created in
-- [notice.start_at, min(now, end_at)] with status <> 'cancelled'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared limit enforcement. Raises 'check_violation' when a cap would be exceeded.
-- p_exclude_order_id lets the edit path ignore the order being modified so that
-- reducing a quantity frees capacity instead of double-counting it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_notice_limits(
    p_notice_id UUID,
    p_items JSONB,
    p_exclude_order_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notice RECORD;
    v_usage_end TIMESTAMPTZ;
    v_total_max INTEGER;
    v_incoming_total INTEGER := 0;
    v_used_total INTEGER := 0;
    v_item JSONB;
    v_pid UUID;
    v_qty INTEGER;
    v_prod_max INTEGER;
    v_prod_used INTEGER;
BEGIN
    -- Lock the notice row so concurrent orders against the same drop serialize.
    SELECT id, is_all_products, start_at, end_at
      INTO v_notice
      FROM notices
     WHERE id = p_notice_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN; -- notice removed mid-flight; nothing to enforce
    END IF;

    v_usage_end := CASE
        WHEN v_notice.end_at IS NOT NULL AND v_notice.end_at < now()
        THEN v_notice.end_at ELSE now()
    END;

    -- ---- total cap -------------------------------------------------------
    SELECT max_quantity INTO v_total_max
      FROM notice_limits
     WHERE notice_id = p_notice_id AND type = 'total'
     LIMIT 1;

    IF v_total_max IS NOT NULL THEN
        -- Incoming counts only products targeted by this notice.
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_pid := (v_item->>'product_id')::UUID;
            v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
            IF v_qty <= 0 THEN CONTINUE; END IF;
            IF v_notice.is_all_products OR EXISTS (
                SELECT 1 FROM notice_products
                 WHERE notice_id = p_notice_id AND product_id = v_pid
            ) THEN
                v_incoming_total := v_incoming_total + v_qty;
            END IF;
        END LOOP;

        SELECT COALESCE(SUM(oi.quantity), 0) INTO v_used_total
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= v_notice.start_at
           AND o.created_at <= v_usage_end
           AND o.status <> 'cancelled'
           AND (p_exclude_order_id IS NULL OR o.id <> p_exclude_order_id)
           AND (
                v_notice.is_all_products
                OR oi.product_id IN (
                    SELECT product_id FROM notice_products WHERE notice_id = p_notice_id
                )
           );

        IF v_used_total + v_incoming_total > v_total_max THEN
            RAISE EXCEPTION 'NOTICE_TOTAL_LIMIT_EXCEEDED: remaining %',
                GREATEST(v_total_max - v_used_total, 0)
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- ---- per-product caps ------------------------------------------------
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_pid := (v_item->>'product_id')::UUID;
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        IF v_qty <= 0 THEN CONTINUE; END IF;

        SELECT max_quantity INTO v_prod_max
          FROM notice_limits
         WHERE notice_id = p_notice_id AND type = 'product' AND product_id = v_pid
         LIMIT 1;
        IF v_prod_max IS NULL THEN CONTINUE; END IF;

        SELECT COALESCE(SUM(oi.quantity), 0) INTO v_prod_used
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         WHERE oi.product_id = v_pid
           AND o.created_at >= v_notice.start_at
           AND o.created_at <= v_usage_end
           AND o.status <> 'cancelled'
           AND (p_exclude_order_id IS NULL OR o.id <> p_exclude_order_id);

        IF v_prod_used + v_qty > v_prod_max THEN
            RAISE EXCEPTION 'NOTICE_PRODUCT_LIMIT_EXCEEDED: product % remaining %',
                v_pid, GREATEST(v_prod_max - v_prod_used, 0)
                USING ERRCODE = 'check_violation';
        END IF;
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- create_order_with_items: adds p_notice_id, delivery fee, subtotal, and
-- atomic limit enforcement. p_notice_id defaults to NULL so existing callers
-- keep working until the app passes the active notice id.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_order_with_items(uuid,text,text,text,text,date,text,text,text,jsonb);

CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_apartment_id UUID,
    p_tower TEXT,
    p_flat_number TEXT,
    p_customer_name TEXT,
    p_phone TEXT,
    p_delivery_date DATE,
    p_payment_method TEXT,
    p_notes TEXT,
    p_entry_channel TEXT,
    p_items JSONB,
    p_notice_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_subtotal NUMERIC := 0;
    v_delivery_fee NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_item JSONB;
    v_price NUMERIC;
    v_qty INTEGER;
    v_edit_token UUID;
    v_apartment_name TEXT;
BEGIN
    SELECT name INTO v_apartment_name FROM apartments WHERE id = p_apartment_id;

    -- Enforce notice limits before doing anything else (holds the notice lock
    -- for the rest of the transaction).
    IF p_notice_id IS NOT NULL THEN
        PERFORM public.enforce_notice_limits(p_notice_id, p_items, NULL);
    END IF;

    v_order_number := generate_order_number();
    v_edit_token := gen_random_uuid();

    -- Server-authoritative pricing from the products table.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        IF v_qty <= 0 THEN CONTINUE; END IF;

        SELECT price INTO v_price
          FROM products
         WHERE id = (v_item->>'product_id')::UUID AND is_active = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found or inactive: %', v_item->>'product_id';
        END IF;

        v_subtotal := v_subtotal + (v_price * v_qty);
    END LOOP;

    IF v_subtotal <= 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    v_delivery_fee := CASE WHEN v_subtotal > 0 AND v_subtotal < 500 THEN 30 ELSE 0 END;
    v_total_amount := v_subtotal + v_delivery_fee;

    INSERT INTO orders (
        order_number, apartment_id, apartment, tower, flat_number,
        customer_name, phone, delivery_date, payment_method, notes, entry_channel,
        status, subtotal, delivery_fee, total_amount, edit_token, is_locked
    ) VALUES (
        v_order_number, p_apartment_id, v_apartment_name, p_tower, p_flat_number,
        p_customer_name, p_phone, p_delivery_date, p_payment_method, p_notes, p_entry_channel,
        'received', v_subtotal, v_delivery_fee, v_total_amount, v_edit_token, false
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        IF v_qty <= 0 THEN CONTINUE; END IF;
        SELECT price INTO v_price FROM products WHERE id = (v_item->>'product_id')::UUID;
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (v_order_id, (v_item->>'product_id')::UUID, v_qty, v_price, v_price * v_qty);
    END LOOP;

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'edit_token', v_edit_token,
        'subtotal', v_subtotal,
        'delivery_fee', v_delivery_fee,
        'total_amount', v_total_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
    uuid,text,text,text,text,date,text,text,text,jsonb,uuid
) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- update_order_with_token: server-authoritative pricing, atomic limits,
-- product validation, and audit history. Client-supplied money params removed.
-- Returns JSONB so callers can distinguish failure reasons.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_order_with_token(uuid,uuid,text,text,numeric,numeric,numeric,jsonb);

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

    -- Enforce limits, excluding this order's current items.
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

    INSERT INTO order_history (order_id, changed_fields, changed_by)
    VALUES (p_order_id, jsonb_build_object(
        'action', 'customer_edit',
        'subtotal', v_subtotal,
        'delivery_fee', v_delivery_fee,
        'total_amount', v_total_amount
    ), p_changed_by);

    RETURN jsonb_build_object(
        'success', true,
        'subtotal', v_subtotal,
        'delivery_fee', v_delivery_fee,
        'total_amount', v_total_amount
    );
END;
$$;

-- NOTE: anon grant intentionally omitted here — workstream B moves this RPC to
-- service-role-only (called from the server loader/action after phone+order-number
-- verification). Until then it is callable only by roles already holding EXECUTE.
GRANT EXECUTE ON FUNCTION public.update_order_with_token(
    uuid,uuid,text,text,jsonb,uuid,text
) TO authenticated;
