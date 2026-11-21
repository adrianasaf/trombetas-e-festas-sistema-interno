#!/usr/bin/env node
/**
 * Marca o banco vinculado como ambiente DEV (app_settings.environment = 'dev').
 * Só funciona se o projeto vinculado for o DEV oficial. O seed de demonstração e os
 * testes de RLS se recusam a rodar sem esse marcador, protegendo a produção.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const DEV_REF = 'zaawhfbmuogfyigxscta'
const refFile = 'supabase/.temp/project-ref'
const ref = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : ''
if (ref !== DEV_REF) {
  console.error(`Projeto vinculado (${ref || 'nenhum'}) não é o DEV (${DEV_REF}). Nada foi feito.`)
  process.exit(1)
}
const sql = `insert into public.app_settings (key, value) values ('environment', 'dev')
  on conflict (key) do update set value = 'dev', updated_at = now();`
const r = spawnSync('npx', ['supabase', 'db', 'query', '--remote', '--yes', sql], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(r.status ?? 1)
