import { useEffect } from 'react';

/**
 * Debug component to verify Supabase configuration
 * This logs the environment variables and client status on mount
 */
export const SupabaseDebug = () => {
  useEffect(() => {
    console.log('=== SUPABASE DEBUG INFO ===');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✓ Present' : '✗ Missing');
    console.log('VITE_SUPABASE_PROJECT_ID:', import.meta.env.VITE_SUPABASE_PROJECT_ID);
    
    // Check if env vars are actually defined
    if (!import.meta.env.VITE_SUPABASE_URL) {
      console.error('❌ VITE_SUPABASE_URL is undefined!');
    }
    if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      console.error('❌ VITE_SUPABASE_PUBLISHABLE_KEY is undefined!');
    }
    
    console.log('==========================');
  }, []);

  return null;
};
