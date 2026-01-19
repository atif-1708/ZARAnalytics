
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

export const SUPABASE_URL = getEnv('SUPABASE_URL') || 'https://hzdygswlxcyeuccmdsro.supabase.co';
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZHlnc3dseGN5ZXVjY21kc3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzU3NDAsImV4cCI6MjA4NDQxMTc0MH0.ewiqIwzzBJTuKSzek6Y9ZbVRXveiVzWztqYCiFiEz8g';

export const isConfigured = () => {
  return SUPABASE_URL && 
         !SUPABASE_URL.includes('your-project-id') && 
         SUPABASE_ANON_KEY && 
         SUPABASE_ANON_KEY !== 'your-anon-key';
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
