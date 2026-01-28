import { createClient } from '@supabase/supabase-js';

/**
 * Client-side Supabase instance
 * Uses anon key for public operations with RLS
 *
 * IMPORTANT: This file can be imported on both server and client
 * - On client: Uses import.meta.env (Vite)
 * - On server: Uses process.env (Node.js)
 */

// Support both client-side (import.meta.env) and server-side (process.env)
const supabaseUrl =
    typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_SUPABASE_URL
        : process.env.VITE_SUPABASE_URL;

const supabaseKey =
    typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_SUPABASE_ANON_KEY
        : process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
    });
}

// Anon client for client-side and public data
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
