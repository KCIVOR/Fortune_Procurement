import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client — persists session in cookies for middleware + API auth. */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

export const db = supabase as any;
