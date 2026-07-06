-- ============================================================================
-- Revoke anon/authenticated on remaining SECURITY DEFINER functions
-- ----------------------------------------------------------------------------
-- Flagged by the Supabase security advisor:
--   * get_dashboard_full_stats — returns revenue / order / customer totals; was
--     callable with the public anon key (business-data leak).
--   * generate_order_number — anon could burn order numbers.
-- Both are only invoked server-side (dashboard loader via service role;
-- generate_order_number internally by create_order_with_items). Lock to service_role.
-- ============================================================================

REVOKE ALL ON FUNCTION public.get_dashboard_full_stats(
    timestamptz, timestamptz, timestamptz, timestamptz, date
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_full_stats(
    timestamptz, timestamptz, timestamptz, timestamptz, date
) TO service_role;

REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;
