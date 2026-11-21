import { describe, expect, it } from 'vitest'
import { readEnv } from './env'

describe('readEnv', () => {
  it('aponta variáveis ausentes', () => {
    const r = readEnv({})
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
    expect(r.config.appEnv).toBe('dev')
  })
  it('aceita configuração completa de produção', () => {
    const r = readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k', VITE_APP_ENV: 'PROD' })
    expect(r.ok).toBe(true)
    expect(r.config.appEnv).toBe('prod')
  })
})
