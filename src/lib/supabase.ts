import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Production Supabase Credentials (Project: Ma Babar Doa Complex - ref: duhltjhvtrqsaxfhfqza)
export const PROD_SUPABASE_URL = 'https://duhltjhvtrqsaxfhfqza.supabase.co';
export const PROD_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aGx0amh2dHJxc2F4ZmhmcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDM5MjQsImV4cCI6MjEwNTgxOTkyNH0.0eSVcC6utdRCC-GBuppJsrSCVYPQ9C3_QLJ7VF3vu94';

// Get Supabase URL and Key explicitly from Vite environment variables, localStorage, or production config
export function getSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  // Explicitly read Vite environment variables
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('ams_supabase_url') || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('ams_supabase_anon_key') || '' : '';

  // Order: UI stored override -> explicit Vite env -> verified production default
  const url = (storedUrl || envUrl || PROD_SUPABASE_URL).trim();
  const key = (storedKey || envKey || PROD_SUPABASE_ANON_KEY).trim();

  const isConfigured = Boolean(
    url &&
    key &&
    url !== 'https://your-project-id.supabase.co' &&
    !url.includes('your-project-id')
  );

  return { url, key, isConfigured };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();

  if (!isConfigured) return null;

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }

  return supabaseInstance;
}

// Direct client export for standard imports
export const supabase = getSupabaseClient();

export function saveSupabaseCredentials(url: string, key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ams_supabase_url', url.trim());
    localStorage.setItem('ams_supabase_anon_key', key.trim());
    supabaseInstance = null; // Reset instance so it recreates
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ams_supabase_url');
    localStorage.removeItem('ams_supabase_anon_key');
    supabaseInstance = null;
  }
}
