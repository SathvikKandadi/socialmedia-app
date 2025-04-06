import { createClient } from '@supabase/supabase-js';

// Replace these with your Supabase project URL and anon key
const supabaseUrl = 'https://milwsihjhjxnpioqncjl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHdzaWhqaGp4bnBpb3FuY2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3NjEyODAsImV4cCI6MjA1OTMzNzI4MH0.d7bVTQnyg8OEQ4cNJXCj7mH-BbBx-Zgm-etw2xIEyGo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 