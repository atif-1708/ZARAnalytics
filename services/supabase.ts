
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  if (typeof window !== 'undefined' && (window as any).process?.env?.[key]) {
    return (window as any).process.env[key];
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return '';
};

// Use provided credentials or fall back to the environment variables
const URL = getEnv('SUPABASE_URL') || 'https://hzdygswlxcyeuccmdsro.supabase.co';
const KEY = getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZHlnc3dseGN5ZXVjY21kc3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzU3NDAsImV4cCI6MjA4NDQxMTc0MH0.ewiqIwzzBJTuKSzek6Y9ZbVRXveiVzWztqYCiFiEz8g';

export const SUPABASE_URL = URL;
export const SUPABASE_ANON_KEY = KEY;

export const isConfigured = () => {
  const isDefault = SUPABASE_URL.includes('your-project-id') || SUPABASE_ANON_KEY === 'your-anon-key';
  return SUPABASE_URL && SUPABASE_ANON_KEY && !isDefault;
};

// Log warning if not configured properly, but don't crash the import
if (!isConfigured()) {
  console.warn("Supabase is not fully configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
