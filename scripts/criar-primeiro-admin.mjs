#!/usr/bin/env node
/**
 * Cadastra o primeiro Administrador do Polo.
 *
 * Pré-requisitos:
 *   1. Supabase CLI logado e projeto vinculado:
 *        npx supabase login
 *        npx supabase link --project-ref <ref-do-projeto>
 *   2. O usuário já existe no Auth: Supabase Dashboard > Authentication > Users >
 *      "Add user" > "Send invitation" (ou "Create new user" com "Auto Confirm User").
 *
 * Uso:
 *   npm run admin:criar -- pessoa@exemplo.com
 *
 * O script chama public.bootstrap_polo_admin(email), função que só o dono do banco
 * pode executar (não é acessível pela API pública).
 */
import { spawnSync } from 'node:child_process'

const email = (process.argv[2] ?? '').trim().toLowerCase()
if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
  console.error('Uso: npm run admin:criar -- pessoa@exemplo.com')
  console.error('Informe um e-mail válido (somente letras, números e . _ % + -).')
  process.exit(1)
}

// O e-mail foi validado pela expressão acima, portanto não contém aspas.
const sql = `select public.bootstrap_polo_admin('${email}') as resultado;`
const result = spawnSync('npx', ['supabase', 'db', 'query', '--remote', '--yes', sql], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (result.status !== 0) {
  console.error('\nNão foi possível cadastrar. Verifique se o projeto está vinculado (npx supabase link)')
  console.error('e se o usuário já foi criado em Authentication > Users.')
  process.exit(result.status ?? 1)
}
console.log('\nPronto. A pessoa já pode entrar no sistema com este e-mail.')
