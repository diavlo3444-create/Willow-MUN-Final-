import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://thenrqgqunwjjsbceayn.supabase.co';

// This is a Supabase publishable key (safe for browser clients), not a service-role key.
// Netlify can override it at build time with VITE_SUPABASE_PUBLISHABLE_KEY.
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_cT_ZFZK7IGZ3for9OkeTAw_jeaHBe7Y';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
