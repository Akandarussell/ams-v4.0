import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL and Key from env or localStorage
export function getSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '';
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('ams_supabase_url') || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('ams_supabase_anon_key') || '' : '';

  const url = storedUrl || envUrl;
  const key = storedKey || envKey;

  const isConfigured = Boolean(url && key && url !== 'https://your-project-id.supabase.co' && !url.includes('your-project-id'));

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
