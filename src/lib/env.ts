export type AppEnv = 'dev' | 'prod'

export interface EnvConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  appEnv: AppEnv
}

export interface EnvResult {
  ok: boolean
  config: EnvConfig
  missing: string[]
}

/** Lê e valida as variáveis públicas do Vite. Nunca use a service_role aqui. */
export function readEnv(source: Record<string, unknown> = import.meta.env): EnvResult {
  const get = (k: string) => (typeof source[k] === 'string' ? (source[k] as string).trim() : '')
  const supabaseUrl = get('VITE_SUPABASE_URL')
  const supabaseAnonKey = get('VITE_SUPABASE_ANON_KEY')
  const appEnv: AppEnv = get('VITE_APP_ENV').toLowerCase() === 'prod' ? 'prod' : 'dev'
  const missing: string[] = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY')
  return { ok: missing.length === 0, config: { supabaseUrl, supabaseAnonKey, appEnv }, missing }
}

export const env = readEnv()
