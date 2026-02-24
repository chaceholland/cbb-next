import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton instance for backwards compatibility
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// Factory function for creating new client instances
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
