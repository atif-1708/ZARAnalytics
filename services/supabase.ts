
import { createClient } from '@supabase/supabase-js';

/**
 * Detects environment variables from various possible sources in the browser.
 */
const getEnvValue = (key: string): string | undefined => {
  // 1. Check window.process.env (set in index.html or by bundler)
  if (typeof window !== 'undefined' && (window as any).process?.env?.[key]) {
    return (window as any).process.env[key];
  }
  
  // 2. Check import.meta.env (Vite/Modern ESM)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }

  return undefined;
};

// Replace these placeholders with your actual Supabase Project URL and Anon Key 
// if you are not using environment variables in your hosting provider.
const FALLBACK_URL = 'https://your-project.supabase.co';
const FALLBACK_KEY = 'your-anon-key';

const SUPABASE_URL = getEnvValue('SUPABASE_URL') || FALLBACK_URL;
const SUPABASE_ANON_KEY = getEnvValue('SUPABASE_ANON_KEY') || FALLBACK_KEY;

if (SUPABASE_URL === FALLBACK_URL || SUPABASE_ANON_KEY === FALLBACK_KEY) {
  console.warn(
    "ZARlytics: Supabase credentials are using fallbacks. " +
    "If the app fails to load, ensure you have set SUPABASE_URL and SUPABASE_ANON_KEY " +
    "in your deployment environment variables or hardcoded them in services/supabase.ts."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
