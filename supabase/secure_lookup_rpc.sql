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

-- Grant access to search function
GRANT EXECUTE ON FUNCTION public.search_orders_by_phone(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.search_orders_by_phone(TEXT) TO authenticated;

COMMENT ON FUNCTION public.search_orders_by_phone(TEXT) IS 
'Search orders by phone number with limited data exposure. Used to allow lookup while keeping RLS strict.';
