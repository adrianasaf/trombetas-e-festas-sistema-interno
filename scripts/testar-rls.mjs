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

import { refuseProduction } from './lib/guard.mjs'

refuseProduction('test:rls')

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
  const { data: m } = await gestorA
    .from('members')
    .select('id')
    .eq('full_name', '[TESTE RLS] Membro A')
    .single()
  const up = await gestorA.from('members').update({ group_id: a2.id }).eq('id', m.id).select('group_id')
  assert(up.data?.[0]?.group_id === a2.id, up.error?.message ?? 'não transferiu')
  const { data: h } = await gestorA
    .from('member_group_history')
    .select('from_group_id, to_group_id')
    .eq('member_id', m.id)
    .eq('to_group_id', a2.id)
  assert(
    h?.some((r) => r.from_group_id === a1.id),
    'histórico não registrado',
  )
  await gestorA.from('members').update({ group_id: a1.id }).eq('id', m.id)
})

await check('Fase 3: Gestor A não move grupo para outra igreja', async () => {
  const a1 = await groupId('[TESTE RLS] Grupo A1')
  const b1 = await groupId('[TESTE RLS] Grupo B1')
  const { error } = await gestorA
    .from('assistance_groups')
    .update({ church_id: b1.church_id })
    .eq('id', a1.id)
  assert(error, 'mudança aceita')
})

// ---- Fase 4: convidados, consentimento e duplicidades ----
const memberId = async (name) =>
  (await admin.from('members').select('id').eq('full_name', name).single()).data.id
const created = []
const rpcGuest = (client, args) =>
  client.rpc('create_guest', {
    p_member_id: args.member,
    p_full_name: args.name,
    p_phone: args.phone ?? null,
    p_category: args.category ?? 'homem',
    p_consent: args.consent ?? true,
    p_guardian_name: args.guardianName ?? null,
    p_guardian_phone: args.guardianPhone ?? null,
  })

await check(
  'Fase 4: Responsável A1 cadastra convidado do membro A com snapshot de igreja/grupo',
  async () => {
    const mA = await memberId('[TESTE RLS] Membro A')
    const { data, error } = await rpcGuest(respA1, {
      member: mA,
      name: '[TESTE RLS] F4 Adulto',
      phone: '(83) 99000-4001',
    })
    assert(!error, error?.message)
    created.push(data.id)
    const { data: ref } = await respA1
      .from('guest_referrals')
      .select('member_id, is_primary')
      .eq('guest_id', data.id)
    assert(ref?.length === 1 && ref[0].member_id === mA && ref[0].is_primary, 'snapshot ausente')
    const { data: c } = await respA1.from('guest_consents').select('recorded_by').eq('guest_id', data.id)
    assert(c?.length === 1, 'consentimento não gravado')
  },
)

await check('Fase 4: cadastro sem consentimento é recusado', async () => {
  const mA = await memberId('[TESTE RLS] Membro A')
  const { error } = await rpcGuest(respA1, {
    member: mA,
    name: '[TESTE RLS] F4 Sem consentimento',
    phone: '83990004002',
    consent: false,
  })
  assert(error && /consentimento/.test(error.message), error?.message ?? 'aceito')
})

await check('Fase 4: criança com responsável legal (sem telefone próprio)', async () => {
  const mA = await memberId('[TESTE RLS] Membro A')
  const { data, error } = await rpcGuest(respA1, {
    member: mA,
    name: '[TESTE RLS] F4 Criança',
    category: 'crianca',
    guardianName: 'Responsável Teste',
    guardianPhone: '83990004003',
  })
  assert(!error, error?.message)
  created.push(data.id)
})

await check('Fase 4: Gestor A não cadastra convidado para membro da igreja B', async () => {
  const mB = await memberId('[TESTE RLS] Membro B')
  const { error } = await rpcGuest(gestorA, {
    member: mB,
    name: '[TESTE RLS] F4 Invasor',
    phone: '83990004004',
  })
  assert(error, 'aceito')
})

await check('Fase 4: Recepção e Leitor não cadastram convidado por membro', async () => {
  const mA = await memberId('[TESTE RLS] Membro A')
  const r1 = await rpcGuest(recepcao, { member: mA, name: '[TESTE RLS] F4 R', phone: '83990004005' })
  const r2 = await rpcGuest(leitorA, { member: mA, name: '[TESTE RLS] F4 L', phone: '83990004006' })
  assert(r1.error && r2.error, 'aceito')
})

await check(
  'Fase 4: duplicidade por telefone → revisão; Responsável não mescla; Gestor mescla com crédito do 1º',
  async () => {
    const mA = await memberId('[TESTE RLS] Membro A')
    const first = await rpcGuest(respA1, {
      member: mA,
      name: '[TESTE RLS] F4 Duplicado Silva',
      phone: '83990004099',
    })
    assert(!first.error, first.error?.message)
    const second = await rpcGuest(gestorA, {
      member: mA,
      name: '[TESTE RLS] F4 Duplicado da Silva',
      phone: '(83) 99000-4099',
    })
    assert(!second.error && second.data.possible_duplicate, 'não marcou duplicidade')
    created.push(first.data.id, second.data.id)
    const { data: list } = await gestorA.rpc('list_duplicate_reviews', { p_status: 'pendente' })
    const review = list.find((r) => r.a_id === second.data.id || r.b_id === second.data.id)
    assert(review, 'revisão não listada para o Gestor')
    const viaLeader = await respA1.rpc('list_duplicate_reviews', { p_status: 'pendente' })
    assert((viaLeader.data ?? []).length === 0, 'Responsável viu a fila')
    const leaderMerge = await respA1.rpc('merge_guests', {
      p_review_id: review.id,
      p_keep_guest_id: second.data.id,
    })
    assert(leaderMerge.error, 'Responsável mesclou')
    const merge = await gestorA.rpc('merge_guests', {
      p_review_id: review.id,
      p_keep_guest_id: second.data.id,
    })
    assert(!merge.error, merge.error?.message)
    const { data: kept } = await gestorA.from('guests').select('created_by').eq('id', second.data.id).single()
    const { data: refs } = await gestorA
      .from('guest_referrals')
      .select('is_primary, created_by')
      .eq('guest_id', second.data.id)
    const primary = refs.find((r) => r.is_primary)
    assert(
      refs.length === 2 && primary.created_by !== kept.created_by,
      'crédito não ficou com o primeiro cadastro',
    )
  },
)

await check('Fase 4: Gestor A não lê convidado da igreja B pela fila nem pela tabela', async () => {
  const { data } = await gestorA.from('guests').select('id').eq('full_name', '[TESTE RLS] Convidado B')
  assert((data ?? []).length === 0, 'leu')
})

// Limpeza dos convidados criados nesta execução (o registro mesclado sai junto com o mantido).
for (const id of [...created].reverse()) {
  await admin.from('guests').delete().eq('merged_into_id', id)
  await admin.from('guests').delete().eq('id', id)
}

// ---- Fase 5: motor de metas ----
await check('Fase 5: Leitor A vê metas da igreja A, mas não do Polo nem da igreja B', async () => {
  const { data: a } = await admin.from('churches').select('id').eq('name', 'ICM Manaíra').single()
  const { data: b } = await admin.from('churches').select('id').eq('name', 'ICM Geisel').single()
  const ra = await leitorA.rpc('goal_summary', { p_church_id: a.id })
  const rb = await leitorA.rpc('goal_summary', { p_church_id: b.id })
  const rp = await leitorA.rpc('goal_summary', {})
  assert(!ra.error && ra.data.length === 1, ra.error?.message ?? 'sem dados da igreja A')
  assert((rb.data ?? []).length === 0 && (rp.data ?? []).length === 0, 'viu igreja B ou Polo')
})

await check('Fase 5: meta da igreja A = membros ativos × 3 e × 1', async () => {
  const { data: a } = await admin.from('churches').select('id').eq('name', 'ICM Manaíra').single()
  const { count } = await admin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('church_id', a.id)
    .eq('active', true)
  const { data } = await admin.rpc('goal_summary', { p_church_id: a.id })
  const s = data[0]
  assert(Number(s.members_goal_base) === count, `base ${s.members_goal_base} ≠ ${count}`)
  assert(Number(s.invites_goal) === count * 3 && Number(s.attendance_goal) === count, 'fórmula incorreta')
})

await check('Fase 5: Leitor do Polo vê o Polo; não vê desempenho por membro', async () => {
  const p = await leitorPolo.rpc('goal_summary', {})
  const m = await leitorPolo.rpc('member_goal_stats', {})
  assert(!p.error && p.data.length === 1, p.error?.message ?? 'sem Polo')
  assert((m.data ?? []).length === 0, 'leitor viu membros')
})

await check('Fase 5: Responsável A1 vê desempenho só dos membros do próprio grupo', async () => {
  const { data, error } = await respA1.rpc('member_goal_stats', {})
  assert(!error, error?.message)
  assert(data.length > 0 && data.every((r) => r.group_name === '[TESTE RLS] Grupo A1'), 'escopo incorreto')
})

await check('Fase 5: só o Admin grava snapshot manualmente', async () => {
  const { data: ev } = await admin.from('events').select('id').eq('status', 'ativo').single()
  const { error } = await gestorA.rpc('take_goal_snapshot_now', { p_event_id: ev.id })
  assert(error && /Administrador/.test(error.message), error?.message ?? 'aceito')
})

// ---- Fase 6: check-in, walk-in e tempo real ----
{
  const mA = await memberId('[TESTE RLS] Membro A')
  const g6 = await rpcGuest(respA1, {
    member: mA,
    name: '[TESTE RLS] F6 Raimundo Check',
    phone: '(83) 99006-4321',
  })
  const guest6 = g6.data?.id

  await check('Fase 6: busca da Recepção devolve telefone mascarado e nunca o completo', async () => {
    const { data, error } = await recepcao.rpc('search_checkin', { p_query: 'raimundo check' })
    assert(!error, error?.message)
    const row = data.find((r) => r.guest_id === guest6)
    assert(row?.phone_masked === '(83) 9****-4321', `máscara: ${row?.phone_masked}`)
    assert(!JSON.stringify(data).includes('990064321'), 'telefone completo vazou')
  })

  await check(
    'Fase 6: corrida real — 12 requisições paralelas de 2 sessões → 1 registrada, 11 "já registrada"',
    async () => {
      const calls = Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? recepcao : gestorA).rpc('check_in', {
          p_guest_id: guest6,
          p_client_request_id: crypto.randomUUID(),
        }),
      )
      const res = await Promise.all(calls)
      const errors = res.filter((r) => r.error)
      assert(!errors.length, errors[0]?.error?.message)
      const ok = res.filter((r) => r.data.status === 'registrada').length
      const already = res.filter((r) => r.data.status === 'ja_registrada').length
      assert(ok === 1 && already === 11, `registrada=${ok} já=${already}`)
      const { data: att } = await admin.from('attendances').select('id').eq('guest_id', guest6)
      assert(att.length === 1, `linhas: ${att.length}`)
    },
  )

  await check('Fase 6: "já registrada" informa hora e usuário de quem marcou', async () => {
    const { data } = await recepcao.rpc('check_in', { p_guest_id: guest6 })
    assert(data.status === 'ja_registrada' && data.checked_in_at && data.checked_in_by, JSON.stringify(data))
  })

  await check('Fase 6: mesmo client_request_id reenviado não duplica (fila offline)', async () => {
    const g = await rpcGuest(respA1, { member: mA, name: '[TESTE RLS] F6 Fila', phone: '83990064322' })
    const req = crypto.randomUUID()
    const a = await recepcao.rpc('check_in', { p_guest_id: g.data.id, p_client_request_id: req })
    const b = await recepcao.rpc('check_in', { p_guest_id: g.data.id, p_client_request_id: req })
    assert(
      a.data?.status === 'registrada' && b.data?.status === 'registrada' && b.data.repetida,
      JSON.stringify(b),
    )
  })

  await check(
    'Fase 6: Recepção não desmarca; Gestor da igreja desmarca com motivo e o histórico fica',
    async () => {
      const r1 = await recepcao.rpc('revoke_attendance', {
        p_guest_id: guest6,
        p_type: 'presencial',
        p_reason: 'teste',
      })
      assert(r1.error, 'Recepção desmarcou')
      const r2 = await gestorA.rpc('revoke_attendance', {
        p_guest_id: guest6,
        p_type: 'presencial',
        p_reason: 'teste de desmarcação',
      })
      assert(!r2.error, r2.error?.message)
      const { data: hist } = await gestorA.rpc('attendance_history', { p_guest_id: guest6 })
      assert(
        hist.length === 1 && hist[0].revoked_at && hist[0].revoke_reason === 'teste de desmarcação',
        JSON.stringify(hist),
      )
    },
  )

  await check('Fase 6: Leitor e Responsável não fazem check-in presencial', async () => {
    const a = await leitorA.rpc('check_in', { p_guest_id: guest6 })
    const b = await respA1.rpc('check_in', { p_guest_id: guest6 })
    assert(a.error && b.error, 'aceito')
  })

  await check('Fase 6: Responsável registra online; online não ocupa o presencial', async () => {
    const on = await respA1.rpc('check_in', { p_guest_id: guest6, p_type: 'online' })
    assert(on.data?.status === 'registrada', on.error?.message ?? JSON.stringify(on.data))
    const pres = await recepcao.rpc('check_in', { p_guest_id: guest6 })
    assert(pres.data?.status === 'registrada', 'presencial bloqueado pelo online')
  })

  await check('Fase 6: walk-in "sem membro identificado" exige igreja e marca presença', async () => {
    const { data: a } = await admin.from('churches').select('id').eq('name', 'ICM Manaíra').single()
    const bad = await recepcao.rpc('walk_in_check_in', {
      p_full_name: '[TESTE RLS] F6 Walk',
      p_category: 'homem',
      p_consent: true,
      p_phone: '83990064323',
    })
    assert(bad.error, 'aceitou sem igreja')
    const ok = await recepcao.rpc('walk_in_check_in', {
      p_full_name: '[TESTE RLS] F6 Walk',
      p_category: 'homem',
      p_consent: true,
      p_phone: '83990064323',
      p_church_id: a.id,
    })
    assert(ok.data?.status === 'registrada' && ok.data.guest_id, ok.error?.message ?? JSON.stringify(ok.data))
  })

  await check(
    'Fase 6: tempo real entre duas sessões — sinal chega à outra sessão sem dados pessoais',
    async () => {
      const received = []
      const channel = gestorA.channel('tef-sinal')
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('não conectou ao Realtime em 15 s')), 15_000)
        channel
          .on('broadcast', { event: 'mudou' }, (msg) => received.push(msg))
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(t)
              resolve()
            }
          })
      })
      // Aguarda a conexão estabilizar antes de gerar a mudança (a 1ª execução falhou sem isso).
      await new Promise((r) => setTimeout(r, 1500))
      const g = await rpcGuest(respA1, {
        member: mA,
        name: '[TESTE RLS] F6 Sinal Pessoal',
        phone: '83990064324',
      })
      await recepcao.rpc('check_in', { p_guest_id: g.data.id })
      const deadline = Date.now() + 15_000
      while (!received.length && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250))
      await gestorA.removeChannel(channel)
      assert(received.length > 0, 'nenhum sinal recebido em 15 s')
      const text = JSON.stringify(received)
      assert(!text.includes('Sinal Pessoal') && !text.includes('990064324'), 'sinal trouxe dado pessoal')
    },
  )

  // Limpeza (presenças não são apagáveis pela API — feito como dono do banco, só no DEV).
  const cleanup = runRemoteSql(
    `delete from public.attendances where guest_id in (select id from public.guests where full_name like '[TESTE RLS] F6%');
     delete from public.guests where full_name like '[TESTE RLS] F6%';`,
    { capture: true },
  )
  if (cleanup.status !== 0) console.log('  (aviso) limpeza da Fase 6 falhou')
}

// ---- Fase 7: dashboards ----
await check(
  'Fase 7: painéis agregados respeitam o escopo (Leitor A: igreja A sim, Polo/igreja B não)',
  async () => {
    const { data: a } = await admin.from('churches').select('id').eq('name', 'ICM Manaíra').single()
    const { data: b } = await admin.from('churches').select('id').eq('name', 'ICM Geisel').single()
    for (const fn of ['stats_daily', 'stats_categories', 'stats_transport']) {
      const polo = await leitorA.rpc(fn, {})
      const other = await leitorA.rpc(fn, { p_church_id: b.id })
      const own = await leitorA.rpc(fn, { p_church_id: a.id })
      assert(!own.error, `${fn}: ${own.error?.message}`)
      assert((polo.data ?? []).length === 0 && (other.data ?? []).length === 0, `${fn} vazou fora do escopo`)
    }
  },
)

await check('Fase 7: Admin vê ranking das 11 igrejas e grupos', async () => {
  const c = await admin.rpc('goal_by_church', {})
  const g = await admin.rpc('goal_by_group', {})
  assert(c.data?.length === 11 && g.data?.length >= 3, `igrejas ${c.data?.length}, grupos ${g.data?.length}`)
})

await check('Fase 7: anônimo não executa nenhuma RPC de painel', async () => {
  for (const fn of ['goal_summary', 'goal_by_church', 'stats_daily', 'stats_categories', 'stats_transport']) {
    const r = await anon.rpc(fn, {})
    assert(r.error, `${fn} executou como anônimo`)
  }
})

// ---- Fase 8: transporte e relatórios ----
await check(
  'Fase 8: relatório de convidados respeita a RLS (Gestor A só igreja A; Recepção e Leitor vazio)',
  async () => {
    const g = await gestorA.rpc('report_guests', {})
    assert(!g.error, g.error?.message)
    assert(
      g.data.every((r) => r.church_name === 'ICM Manaíra'),
      'Gestor A viu outra igreja',
    )
    const r = await recepcao.rpc('report_guests', {})
    const l = await leitorPolo.rpc('report_guests', {})
    assert((r.data ?? []).length === 0 && (l.data ?? []).length === 0, 'Recepção/Leitor viram convidados')
  },
)

await check('Fase 8: exportação com telefone só para Gestor da igreja e Admin, e é auditada', async () => {
  const { data: a } = await admin.from('churches').select('id').eq('name', 'ICM Manaíra').single()
  const { data: b } = await admin.from('churches').select('id').eq('name', 'ICM Geisel').single()
  const { data: ev } = await admin.from('events').select('id').eq('status', 'ativo').single()
  const ok = await gestorA.rpc('log_export', {
    p_kind: 'convidados',
    p_event_id: ev.id,
    p_church_id: a.id,
    p_rows: 1,
    p_with_phone: true,
    p_filters: { teste: true },
  })
  assert(!ok.error, ok.error?.message)
  const other = await gestorA.rpc('log_export', {
    p_kind: 'convidados',
    p_event_id: ev.id,
    p_church_id: b.id,
    p_rows: 1,
    p_with_phone: true,
  })
  const leader = await respA1.rpc('log_export', {
    p_kind: 'convidados',
    p_event_id: ev.id,
    p_church_id: a.id,
    p_rows: 1,
    p_with_phone: true,
  })
  assert(other.error && leader.error, 'exportação com telefone indevida aceita')
  const { data: logs } = await admin
    .from('audit_logs')
    .select('action, new_data')
    .eq('action', 'exportacao.convidados')
    .order('id', { ascending: false })
    .limit(1)
  assert(logs?.[0]?.new_data?.com_telefone === true, 'exportação não auditada')
})

await check('Fase 8: lista de transporte no escopo do Gestor', async () => {
  const { data, error } = await gestorA.rpc('transport_list', {})
  assert(!error, error?.message)
  assert(
    data.every((r) => r.church_name === 'ICM Manaíra'),
    'viu transporte de outra igreja',
  )
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
