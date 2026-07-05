-- ============================================================================
-- Drop legacy order RPCs (cleanup — apply AFTER the new app is confirmed live)
-- ----------------------------------------------------------------------------
-- Once the new app is deployed and verified, the old function overload and the
-- retired anon-callable lookup RPCs are no longer used. Removing them shrinks the
-- attack surface (the old lookup RPCs leaked edit_token on a bare phone number).
--
-- Safe to apply once no client calls the old signatures anymore.
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_order_with_token(uuid,uuid,text,text,numeric,numeric,numeric,jsonb);
DROP FUNCTION IF EXISTS public.search_orders_by_phone(text);
DROP FUNCTION IF EXISTS public.get_order_for_edit(uuid,uuid);
