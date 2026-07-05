-- ============================================================================
-- Atomic notice targeting replacement
-- ----------------------------------------------------------------------------
-- The notice edit/create flows replaced a notice's targeted products and
-- quantity limits with an unchecked delete-then-insert. If an insert failed
-- after the deletes, an ACTIVE notice could silently lose all its limits and
-- customers could order unlimited quantities.
--
-- This helper does the delete + re-insert in a single transaction, so it either
-- fully applies the new targeting or leaves the old targeting untouched.
--
-- Additive/backward compatible: applying this ahead of the app is safe.
-- Restricted to service_role (called from the server via the service key).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_notice_targeting(
    p_notice_id UUID,
    p_product_ids UUID[],
    p_limits JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pid UUID;
    v_limit JSONB;
BEGIN
    DELETE FROM notice_products WHERE notice_id = p_notice_id;
    DELETE FROM notice_limits WHERE notice_id = p_notice_id;

    IF p_product_ids IS NOT NULL THEN
        FOREACH v_pid IN ARRAY p_product_ids
        LOOP
            INSERT INTO notice_products (notice_id, product_id) VALUES (p_notice_id, v_pid);
        END LOOP;
    END IF;

    IF p_limits IS NOT NULL THEN
        FOR v_limit IN SELECT * FROM jsonb_array_elements(p_limits)
        LOOP
            INSERT INTO notice_limits (notice_id, type, product_id, max_quantity)
            VALUES (
                p_notice_id,
                v_limit->>'type',
                CASE
                    WHEN COALESCE(v_limit->>'product_id', '') = '' THEN NULL
                    ELSE (v_limit->>'product_id')::UUID
                END,
                (v_limit->>'max_quantity')::INTEGER
            );
        END LOOP;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_notice_targeting(uuid, uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_notice_targeting(uuid, uuid[], jsonb) TO service_role;
