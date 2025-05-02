import { createClient } from '@supabase/supabase-js';

// Replace these with your Supabase project URL and anon key
const supabaseUrl = 'your-supabase-url';
const supabaseAnonKey = 'your-supabase-anonkey';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 