import { createClient } from '@supabase/supabase-js';

// This is a single-region service (India). Pin the server runtime timezone to
// IST — baked in rather than a deploy-time env var, since the region does not
// change — so admin-entered notice times and delivery dates are interpreted and
// rendered in local time instead of the host's UTC (e.g. on Vercel). Every
// date-sensitive server path imports this module, so setting it here runs before
// any request-time Date usage. Node calls tzset() on assignment.
if (typeof process !== 'undefined' && process.env.TZ !== 'Asia/Kolkata') {
    process.env.TZ = 'Asia/Kolkata';
}

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
