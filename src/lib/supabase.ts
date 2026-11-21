import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Cliente público (anon key). A segurança real está nas políticas RLS do banco.
export const supabase = createClient(
  env.config.supabaseUrl || 'http://localhost:54321',
  env.config.supabaseAnonKey || 'chave-ausente',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  },
)
