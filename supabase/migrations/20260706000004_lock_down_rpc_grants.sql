-- ============================================================================
-- Lock down order/notice RPC execution to service_role only
-- ----------------------------------------------------------------------------
-- Supabase's default privileges auto-grant EXECUTE to anon/authenticated on new
-- functions, so `REVOKE ... FROM PUBLIC` alone left these callable directly with
-- the public anon key. All of these functions are invoked only server-side via
-- the service role, so we revoke anon/authenticated/PUBLIC and grant service_role.
--
-- Without this, anon could call update_order_with_token or replace_notice_targeting
-- directly (mutating/erasing order and notice data) with just the public key.
-- ============================================================================

DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.create_order_with_items(uuid,text,text,text,text,date,text,text,text,jsonb,uuid)',
        'public.update_order_with_token(uuid,uuid,text,text,jsonb,uuid,text)',
        'public.enforce_notice_limits(uuid,jsonb,uuid)',
        'public.replace_notice_targeting(uuid,uuid[],jsonb)'
    ]
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END $$;
