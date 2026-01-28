import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client with service role key
 *
 * IMPORTANT: This client bypasses Row Level Security (RLS)
 * Only use this for:
 * - Admin operations (product/order management)
 * - Server-side actions that require elevated privileges
 * - Operations that need to bypass RLS policies
 *
 * NEVER expose this client or its key to the browser/client-side!
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseServiceRoleKey) {
    throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
        'Get this from: Supabase Dashboard > Settings > API > service_role key'
    );
}

/**
 * Admin Supabase client with full database access
 * Bypasses RLS policies - use with caution!
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
