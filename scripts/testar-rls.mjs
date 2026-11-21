#!/usr/bin/env node
/**
 * Testa as políticas RLS contra o banco REAL do projeto DEV, pela API pública (anon key),
 * com usuários de teste de perfis diferentes.
 *
 * Pré-requisitos: projeto vinculado (npx supabase link) e .env.local com
 * VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Nunca usa a service_role.
 *
 * Uso: npm run test:rls
 */
import { runRemoteSql } from './lib/db-query.mjs'
import { randomBytes } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(import.meta.dirname, '..')

function loadEnv() {
  const file = path.join(root, '.env.local')
  const env = { ...process.env }
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
  return env
}

const env = loadEnv()
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
if (!URL || !ANON) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local.')
  process.exit(1)
}

// 1) Prepara usuários/dados de teste com uma senha aleatória desta execução.
const password = `Rls-${randomBytes(12).toString('hex')}9`
const sql = readFileSync(path.join(root, 'scripts/sql/preparar-teste-rls.sql'), 'utf8').replaceAll(
  '{{SENHA}}',
  password,
)
const prep = runRemoteSql(sql, { capture: true })
if (prep.status !== 0) {
  console.error('Falha ao preparar os dados de teste:\n', prep.stderr || prep.stdout)
  process.exit(1)
}

// 2) Executa os cenários pela API.
const results = []
async function check(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (e) {
    results.push({ name, ok: false, error: e.message })
    console.log(`  ✗ ${name}\n      ${e.message}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function login(user) {
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: `${user}@teste.trombetas.dev`, password })
  if (error) throw new Error(`login de ${user} falhou: ${error.message}`)
  return client
}

const anon = createClient(URL, ANON, { auth: { persistSession: false } })
const admin = await login('rls.admin')
const gestorA = await login('rls.gestor.a')
const respA1 = await login('rls.resp.a1')
const recepcao = await login('rls.recepcao')
const leitorA = await login('rls.leitor.a')
const leitorPolo = await login('rls.leitor.polo')

const names = (rows) => (rows ?? []).map((r) => r.full_name)

console.log('\nTestes de RLS via API (banco real):')

await check('anônimo não lê igrejas nem convidados', async () => {
  const c = await anon.from('churches').select('id')
  const g = await anon.from('guests').select('id')
  assert((c.error || c.data.length === 0) && (g.error || g.data.length === 0), 'anônimo leu dados')
})

await check('seed: 11 igrejas visíveis para o admin', async () => {
  const { data, error } = await admin.from('churches').select('id')
  assert(!error && data.length === 11, `esperado 11, veio ${data?.length} ${error?.message ?? ''}`)
})

await check('Gestor A vê o convidado da igreja A e NÃO o da igreja B', async () => {
  const { data, error } = await gestorA.from('guests').select('full_name').like('full_name', '[TESTE RLS]%')
  assert(!error, error?.message)
  const n = names(data)
  assert(n.includes('[TESTE RLS] Convidado A'), 'não viu o convidado A')
  assert(!n.includes('[TESTE RLS] Convidado B'), 'viu o convidado da outra igreja')
})

await check('Gestor A não altera convidado da igreja B', async () => {
  const { data } = await gestorA
    .from('guests')
    .update({ notes: 'tentativa' })
    .eq('full_name', '[TESTE RLS] Convidado B')
    .select('id')
  assert((data ?? []).length === 0, 'conseguiu alterar')
  const check2 = await admin
    .from('guests')
    .select('notes')
    .eq('full_name', '[TESTE RLS] Convidado B')
    .single()
  assert(check2.data?.notes !== 'tentativa', 'o dado foi alterado')
})

await check('Gestor A não cria membro em grupo da igreja B', async () => {
  const { data: g } = await admin
    .from('assistance_groups')
    .select('id')
    .eq('name', '[TESTE RLS] Grupo B1')
    .single()
  const { error } = await gestorA
    .from('members')
    .insert({ full_name: 'Invasor', group_id: g.id, church_id: g.id })
  assert(error, 'inserção foi aceita')
})

await check('Gestor A não muda o crédito (igreja) de um convidado', async () => {
  const { data: b } = await admin.from('churches').select('id').eq('name', 'ICM Geisel').single()
  const { error } = await gestorA
    .from('guests')
    .update({ church_id: b.id })
    .eq('full_name', '[TESTE RLS] Convidado A')
  assert(error, 'alteração de crédito foi aceita')
})

await check('Gestor A não concede perfil de Administrador', async () => {
  const { data: u } = await gestorA.from('profiles').select('id').limit(1)
  const target = u?.[0]?.id
  const { data: me } = await gestorA.auth.getUser()
  const { error } = await gestorA
    .from('role_assignments')
    .insert({ user_id: target ?? me.user.id, role: 'polo_admin', created_by: me.user.id })
  assert(error, 'concessão de admin foi aceita')
})

await check('Responsável A1 vê só membros do próprio grupo', async () => {
  const { data, error } = await respA1.from('members').select('full_name').like('full_name', '[TESTE RLS]%')
  assert(!error, error?.message)
  assert(JSON.stringify(names(data)) === JSON.stringify(['[TESTE RLS] Membro A']), `viu: ${names(data)}`)
})

await check('Recepção não lê a tabela de convidados (telefones)', async () => {
  const { data } = await recepcao.from('guests').select('phone_normalized')
  assert((data ?? []).length === 0, 'recepção leu telefones')
})

await check('Recepção não insere presença diretamente', async () => {
  const { data: ev } = await admin.from('events').select('id').eq('status', 'ativo').single()
  const { data: g } = await admin
    .from('guests')
    .select('id')
    .eq('full_name', '[TESTE RLS] Convidado A')
    .single()
  const { error } = await recepcao
    .from('attendances')
    .insert({ event_id: ev.id, guest_id: g.id, type: 'presencial' })
  assert(error, 'inserção direta aceita')
})

await check('Leitor (igreja A e Polo) não vê nomes nem telefones de convidados', async () => {
  const a = await leitorA.from('guests').select('full_name, phone_normalized')
  const p = await leitorPolo.from('guests').select('full_name, phone_normalized')
  assert((a.data ?? []).length === 0 && (p.data ?? []).length === 0, 'leitor viu convidados')
})

await check('Leitor não vê membros', async () => {
  const { data } = await leitorA.from('members').select('full_name')
  assert((data ?? []).length === 0, 'leitor viu membros')
})

await check('bootstrap_polo_admin não é executável pela API', async () => {
  const { error } = await gestorA.rpc('bootstrap_polo_admin', { p_email: 'rls.gestor.a@teste.trombetas.dev' })
  assert(error, 'função executou')
})

await check('find_user_id_by_email não é executável pela API', async () => {
  const { error } = await gestorA.rpc('find_user_id_by_email', { p_email: 'rls.admin@teste.trombetas.dev' })
  assert(error, 'função executou')
})

await check('Gestor A não lê auditoria de outra igreja', async () => {
  const { data: a } = await admin.from('churches').select('id').eq('name', 'ICM Manaíra').single()
  const { data } = await gestorA.from('audit_logs').select('church_id')
  assert(
    (data ?? []).every((r) => r.church_id === a.id),
    'viu auditoria de outra igreja',
  )
})

// Edge Function convidar-usuario — apenas casos que NÃO enviam e-mail.
async function invoke(client, body) {
  const { data, error } = await client.functions.invoke('convidar-usuario', { body })
  let status = 200
  let payload = data
  if (error) {
    status = error.context?.status ?? 0
    try {
      payload = await error.context.json()
    } catch {
      payload = null
    }
  }
  return { status, payload }
}

await check('Convite: Gestor A não pode conceder Administrador (403)', async () => {
  const r = await invoke(gestorA, { email: 'qualquer@teste.trombetas.dev', role: 'polo_admin' })
  assert(r.status === 403, `status ${r.status} ${JSON.stringify(r.payload)}`)
})

await check('Convite: Responsável de Grupo não pode convidar (403)', async () => {
  const { data: a } = await admin.from('churches').select('id').eq('name', 'ICM Manaíra').single()
  const r = await invoke(respA1, { email: 'qualquer@teste.trombetas.dev', role: 'reader', church_id: a.id })
  assert(r.status === 403, `status ${r.status}`)
})

await check('Convite: sem sessão é recusado (401)', async () => {
  const r = await invoke(anon, { email: 'qualquer@teste.trombetas.dev', role: 'reader' })
  assert(r.status === 401, `status ${r.status}`)
})

await check('Convite: Gestor A adiciona perfil a usuário existente da igreja A (sem e-mail)', async () => {
  const { data: g } = await admin
    .from('assistance_groups')
    .select('id, church_id')
    .eq('name', '[TESTE RLS] Grupo A1')
    .single()
  const r = await invoke(gestorA, {
    email: 'rls.leitor.a@teste.trombetas.dev',
    role: 'group_leader',
    church_id: g.church_id,
    group_id: g.id,
  })
  assert(
    r.status === 200 && r.payload?.ok && r.payload.invited === false,
    `status ${r.status} ${JSON.stringify(r.payload)}`,
  )
  // Limpeza: o próprio gestor remove a atribuição criada.
  const { data: removed } = await gestorA
    .from('role_assignments')
    .delete()
    .eq('role', 'group_leader')
    .eq('group_id', g.id)
    .neq('user_id', (await respA1.auth.getUser()).data.user.id)
    .select('id')
  assert((removed ?? []).length === 1, 'não removeu a atribuição de teste')
})

// ---- Fase 3: cadastros ----
const groupId = async (name) =>
  (await admin.from('assistance_groups').select('id, church_id').eq('name', name).single()).data

await check('Fase 3: Leitor A vê só a igreja A em church_overview', async () => {
  const { data, error } = await leitorA.rpc('church_overview')
  assert(!error, error?.message)
  assert(data.length === 1 && data[0].name === 'ICM Manaíra', `viu ${data.map((c) => c.name)}`)
})

await check('Fase 3: Leitor do Polo vê as 11 igrejas agregadas', async () => {
  const { data } = await leitorPolo.rpc('church_overview')
  assert(data?.length === 11, `viu ${data?.length}`)
})

await check('Fase 3: Responsável A1 cadastra membro no grupo sem informar igreja', async () => {
  const g = await groupId('[TESTE RLS] Grupo A1')
  const { data, error } = await respA1
    .from('members')
    .insert({ full_name: '[TESTE RLS] Membro novo', group_id: g.id })
    .select('id, church_id')
    .single()
  assert(!error, error?.message)
  assert(data.church_id === g.church_id, 'igreja não veio do grupo')
  await admin.from('member_group_history').select('id').eq('member_id', data.id)
  const del = await gestorA.from('members').delete().eq('id', data.id).select('id')
  assert(del.data?.length === 1, 'limpeza falhou')
})

await check('Fase 3: Responsável A1 não cadastra membro no grupo A2', async () => {
  const g = await groupId('[TESTE RLS] Grupo A2')
  const { error } = await respA1.from('members').insert({ full_name: 'X', group_id: g.id })
  assert(error, 'inserção aceita')
})

await check('Fase 3: Gestor A transfere membro A1 → A2 e o histórico é gravado', async () => {
  const a1 = await groupId('[TESTE RLS] Grupo A1')
  const a2 = await groupId('[TESTE RLS] Grupo A2')
  const { data: m } = await gestorA.from('members').select('id').eq('full_name', '[TESTE RLS] Membro A').single()
  const up = await gestorA.from('members').update({ group_id: a2.id }).eq('id', m.id).select('group_id')
  assert(up.data?.[0]?.group_id === a2.id, up.error?.message ?? 'não transferiu')
  const { data: h } = await gestorA
    .from('member_group_history')
    .select('from_group_id, to_group_id')
    .eq('member_id', m.id)
    .eq('to_group_id', a2.id)
  assert(h?.some((r) => r.from_group_id === a1.id), 'histórico não registrado')
  await gestorA.from('members').update({ group_id: a1.id }).eq('id', m.id)
})

await check('Fase 3: Gestor A não move grupo para outra igreja', async () => {
  const a1 = await groupId('[TESTE RLS] Grupo A1')
  const b1 = await groupId('[TESTE RLS] Grupo B1')
  const { error } = await gestorA.from('assistance_groups').update({ church_id: b1.church_id }).eq('id', a1.id)
  assert(error, 'mudança aceita')
})

// Fases seguintes acrescentam cenários aqui (check-in, máscara de telefone, etc.).
const extra = path.join(root, 'scripts/testar-rls.extra.mjs')
if (existsSync(extra)) {
  const mod = await import(`file://${extra}`)
  await mod.default({ check, assert, admin, gestorA, respA1, recepcao, leitorA, leitorPolo, anon })
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} cenários aprovados.`)
process.exit(failed.length ? 1 : 0)
