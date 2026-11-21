import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { runRemoteSql } from './db-query.mjs'

const root = path.resolve(import.meta.dirname, '../..')

export function loadEnv() {
  const file = path.join(root, '.env.local')
  const env = { ...process.env }
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local.')
  }
  return env
}

/**
 * Cria/atualiza os usuários de teste no DEV com uma senha aleatória desta execução
 * (não gravada em arquivo nem exibida). Exige app_settings.environment = 'dev'.
 */
export function prepareTestUsers() {
  const password = `Rls-${randomBytes(12).toString('hex')}9`
  const sql = readFileSync(path.join(root, 'scripts/sql/preparar-teste-rls.sql'), 'utf8').replaceAll(
    '{{SENHA}}',
    password,
  )
  const r = runRemoteSql(sql, { capture: true })
  if (r.status !== 0)
    throw new Error(`Falha ao preparar usuários de teste: ${(r.stdout || r.stderr || '').slice(-800)}`)
  return password
}

export async function loginAs(env, user, password) {
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email: `${user}@teste.trombetas.dev`, password })
  if (error) throw new Error(`login de ${user} falhou: ${error.message}`)
  return client
}
