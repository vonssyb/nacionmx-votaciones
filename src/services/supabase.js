import { createClient } from '@supabase/supabase-js';

// Hardcoded for production stability (Env vars missing in GH Actions)
const supabaseUrl = 'https://igjedwdxqwkpbgrmtrrq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnamVkd2R4cXdrcGJncm10cnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzQxMjQsImV4cCI6MjA4MTMxMDEyNH0.KyKd_kMFNGZbDtOpsu4ll5elOoc01D4HDk6rKgpDJcI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
