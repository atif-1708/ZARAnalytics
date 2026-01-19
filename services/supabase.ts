
import { createClient } from '@supabase/supabase-js';

/**
 * These values are pulled from the environment.
 * When deploying to Vercel/Netlify, you must add these in the dashboard.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project-url.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project-url')) {
  console.warn("Supabase URL is not configured. Database features will fail.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
