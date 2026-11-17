import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://thenrqgqunwjjsbceayn.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabasePublishableKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY. Add the Supabase publishable key to the deployment environment.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey || 'missing-publishable-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
