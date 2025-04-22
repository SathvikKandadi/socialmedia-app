import { createClient } from '@supabase/supabase-js';

// Replace these with your Supabase project URL and anon key
const supabaseUrl = 'You Supabase URL';
const supabaseAnonKey = 'Your Supabase AnonKey';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 