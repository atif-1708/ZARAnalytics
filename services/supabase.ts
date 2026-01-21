
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  // Use a safer, more standard way to access process.env in the browser
  try {
    if (typeof window !== 'undefined' && (window as any).process?.env) {
      return (window as any).process.env[key] || '';
    }
  } catch (e) {
    // Fallback if process.env access is restricted
  }
  return '';
};

const URL = getEnv('SUPABASE_URL') || 'https://hzdygswlxcyeuccmdsro.supabase.co';
const KEY = getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZHlnc3dseGN5ZXVjY21kc3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzU3NDAsImV4cCI6MjA4NDQxMTc0MH0.ewiqIwzzBJTuKSzek6Y9ZbVRXveiVzWztqYCiFiEz8g';

export const SUPABASE_URL = URL;
export const SUPABASE_ANON_KEY = KEY;

export const isConfigured = () => {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project-id'));
};

if (!isConfigured()) {
  console.warn("ZARlytics Notice: SUPABASE_URL/KEY are not set. Ensure they are configured in your deployment settings.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
