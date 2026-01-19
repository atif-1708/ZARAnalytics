
import { createClient } from '@supabase/supabase-js';

/**
 * Safer way to handle environment variables in a browser environment.
 * If you are hardcoding for a quick test, replace the strings below.
 * For production, your build tool (Vite/Vercel) will usually inject these.
 */
const getEnv = (key: string, fallback: string): string => {
  try {
    // Check for Node-style process.env
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
    // Check for Vite-style import.meta.env
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key] as string;
    }
  } catch (e) {
    // Fallback if access is blocked
  }
  return fallback;
};

const SUPABASE_URL = getEnv('SUPABASE_URL', 'https://your-project-url.supabase.co');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY', 'your-anon-key');

// Log a helpful message instead of crashing
if (SUPABASE_URL.includes('your-project-url')) {
  console.error(
    "ZARlytics Error: Supabase credentials are not configured. " +
    "Please set SUPABASE_URL and SUPABASE_ANON_KEY in your deployment dashboard (e.g. Vercel Settings)."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
