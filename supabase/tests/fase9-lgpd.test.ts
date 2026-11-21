// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture
let g1: string
let g2: string

async function guest(name: string, phone: string) {
  const [r] = await t.as<{ r: { id: string } }>(
    f.users.admin,
    `select public.create_guest(p_member_id => $1, p_full_name => $2, p_phone => $3, p_category => 'homem',
      p_consent => true, p_mode => 'presencial') as r`,
    [f.memberA1, name, phone],
  )
  return r.r.id
}

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
  g1 = await guest('Titular Pedido Silva', '83981250001')
  g2 = await guest('Outro Convidado Lima', '83981250002')
  await t.as(f.users.reception, `select public.check_in($1)`, [g1])
  await t.as(f.users.reception, `select public.check_in($1)`, [g2])
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('direitos do titular', () => {
  it('só o Admin localiza o titular', async () => {
    await expect(t.as(f.users.managerA, `select * from public.find_titular('titular')`)).rejects.toThrow(
      /Administrador/,
    )
    const rows = await t.as<{ guest_id: string }>(
      f.users.admin,
      `select * from public.find_titular('81250001')`,
    )
    expect(rows.map((r) => r.guest_id)).toEqual([g1])
  })

  it('anonimizar remove nome e telefone e preserva a presença nas estatísticas', async () => {
    const before = await t.as<{ present_unique: number }>(
      f.users.admin,
      `select present_unique from public.goal_summary($1)`,
      [f.eventId],
    )
    await t.as(
      f.users.admin,
      `select public.titular_request($1, 'anonimizar', 'Pedido do titular por telefone em 21/11')`,
      [g1],
    )
    const [g] = await t.admin<{
      full_name: string
      phone_normalized: string | null
      anonymized_at: string | null
    }>(`select full_name, phone_normalized, anonymized_at from public.guests where id = $1`, [g1])
    expect(g.full_name).toMatch(/^Convidado anonimizado /)
    expect(g.phone_normalized).toBeNull()
    expect(g.anonymized_at).not.toBeNull()
    const after = await t.as<{ present_unique: number }>(
      f.users.admin,
      `select present_unique from public.goal_summary($1)`,
      [f.eventId],
    )
    expect(Number(after[0].present_unique)).toBe(Number(before[0].present_unique))
  })

  it('a auditoria do convidado anonimizado não guarda mais nome nem telefone', async () => {
    const rows = await t.admin<{ old_data: unknown; new_data: unknown }>(
      `select old_data, new_data from public.audit_logs where table_name = 'guests' and record_id = $1`,
      [g1],
    )
    expect(rows.length).toBeGreaterThan(0)
    const text = JSON.stringify(rows)
    expect(text).not.toContain('Titular Pedido')
    expect(text).not.toContain('5583981250001')
  })

  it('o log do pedido não guarda nome nem telefone', async () => {
    const [log] = await t.admin<{ new_data: unknown }>(
      `select new_data from public.audit_logs where action = 'lgpd.titular_anonimizar'`,
    )
    const text = JSON.stringify(log.new_data)
    expect(text).not.toContain('Titular Pedido')
    expect(text).not.toContain('81250001')
  })

  it('excluir remove o convidado, inclusive a presença', async () => {
    await t.as(
      f.users.admin,
      `select public.titular_request($1, 'excluir', 'Titular pediu exclusão por e-mail')`,
      [g2],
    )
    expect(await t.admin(`select 1 from public.guests where id = $1`, [g2])).toHaveLength(0)
    expect(await t.admin(`select 1 from public.attendances where guest_id = $1`, [g2])).toHaveLength(0)
  })

  it('exige justificativa e perfil Admin', async () => {
    await expect(
      t.as(f.users.admin, `select public.titular_request($1, 'anonimizar', 'curto')`, [g1]),
    ).rejects.toThrow(/mínimo/)
    await expect(
      t.as(
        f.users.managerA,
        `select public.titular_request($1, 'excluir', 'justificativa suficiente aqui')`,
        [g1],
      ),
    ).rejects.toThrow(/Administrador/)
  })
})

describe('anonimização por retenção', () => {
  it('não anonimiza edição ativa nem antes do prazo', async () => {
    await expect(t.as(f.users.admin, `select public.anonymize_event($1)`, [f.eventId])).rejects.toThrow(
      /encerrada/,
    )
    await t.admin(`update public.events set status = 'encerrado' where id = $1`, [f.eventId])
    await expect(t.as(f.users.admin, `select public.anonymize_event($1)`, [f.eventId])).rejects.toThrow(
      /prazo de retenção/,
    )
  })

  it('depois do prazo anonimiza todos e preserva os totais', async () => {
    await guest('Mais Um Convidado', '83981250003').catch(() => undefined) // edição encerrada: recusado
    await t.admin(`update public.events set closed_at = now() - interval '181 days' where id = $1`, [
      f.eventId,
    ])
    const before = await t.as<{ guests_unique: number }>(
      f.users.admin,
      `select guests_unique from public.goal_summary($1)`,
      [f.eventId],
    )
    const [r] = await t.as<{ n: number }>(f.users.admin, `select public.anonymize_event($1) n`, [f.eventId])
    expect(r.n).toBeGreaterThanOrEqual(0)
    const left = await t.admin(
      `select 1 from public.guests where event_id = $1 and anonymized_at is null and merged_into_id is null`,
      [f.eventId],
    )
    expect(left).toHaveLength(0)
    const after = await t.as<{ guests_unique: number }>(
      f.users.admin,
      `select guests_unique from public.goal_summary($1)`,
      [f.eventId],
    )
    expect(after[0].guests_unique).toBe(before[0].guests_unique)
  })

  it('Gestor não anonimiza', async () => {
    await expect(t.as(f.users.managerA, `select public.anonymize_event($1)`, [f.eventId])).rejects.toThrow(
      /Administrador/,
    )
  })
})

describe('auditoria', () => {
  it('Admin vê os registros com nome do usuário', async () => {
    const rows = await t.as<{ user_name: string; action: string }>(
      f.users.admin,
      `select * from public.list_audit_logs(200)`,
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r) => r.action === 'lgpd.anonimizar_evento')).toBe(true)
  })
  it('Gestor vê só a própria igreja; Leitor e Recepção não veem nada', async () => {
    const rows = await t.as<{ church_name: string | null }>(
      f.users.managerA,
      `select church_name from public.list_audit_logs(200)`,
    )
    expect(rows.every((r) => r.church_name === 'ICM Manaíra')).toBe(true)
    expect(await t.as(f.users.readerA, `select 1 from public.list_audit_logs(200)`)).toHaveLength(0)
    expect(await t.as(f.users.reception, `select 1 from public.list_audit_logs(200)`)).toHaveLength(0)
  })
})
