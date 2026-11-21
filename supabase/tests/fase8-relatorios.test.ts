// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture
let present: string

async function guest(member: string, name: string, phone: string, extra: Record<string, string> = {}) {
  const [r] = await t.as<{ r: { id: string } }>(
    f.users.admin,
    `select public.create_guest(p_member_id => $1, p_full_name => $2, p_phone => $3, p_category => $4::public.guest_category,
      p_consent => true, p_mode => $5::public.participation_mode, p_transport => $6::public.transport_need,
      p_is_authority => $7) as r`,
    [
      member,
      name,
      phone,
      extra.category ?? 'homem',
      extra.mode ?? 'presencial',
      extra.transport ?? 'meios_proprios',
      extra.authority === 'true',
    ],
  )
  return r.r.id
}

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
  present = await guest(f.memberA1, 'Presente Silva', '83981240001', { authority: 'true' })
  await guest(f.memberA1, 'Ausente Souza', '83981240002', { transport: 'precisa_transporte' })
  await guest(f.memberB1, 'Outra Igreja', '83981240003', { transport: 'precisa_transporte' })
  await t.as(f.users.reception, `select public.check_in($1)`, [present])
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('relatório de convidados', () => {
  it('filtra presentes e ausentes', async () => {
    const p = await t.as<{ full_name: string }>(
      f.users.admin,
      `select full_name from public.report_guests(p_presence => 'presente')`,
    )
    const a = await t.as<{ full_name: string }>(
      f.users.admin,
      `select full_name from public.report_guests(p_presence => 'ausente')`,
    )
    expect(p.map((r) => r.full_name)).toEqual(['Presente Silva'])
    expect(a.map((r) => r.full_name).sort()).toEqual(['Ausente Souza', 'Outra Igreja'])
  })
  it('filtra marcação especial e transporte', async () => {
    expect(
      await t.as(f.users.admin, `select 1 from public.report_guests(p_special => 'autoridade')`),
    ).toHaveLength(1)
    expect(
      await t.as(f.users.admin, `select 1 from public.report_guests(p_transport => 'precisa_transporte')`),
    ).toHaveLength(2)
  })
  it('respeita a RLS: Gestor A só vê a igreja A; Recepção e Leitor não veem ninguém', async () => {
    const m = await t.as<{ church_name: string }>(
      f.users.managerA,
      `select church_name from public.report_guests()`,
    )
    expect(m.every((r) => r.church_name === 'ICM Manaíra')).toBe(true)
    expect(m).toHaveLength(2)
    expect(await t.as(f.users.reception, `select 1 from public.report_guests()`)).toHaveLength(0)
    expect(await t.as(f.users.readerPolo, `select 1 from public.report_guests()`)).toHaveLength(0)
  })
})

describe('transporte', () => {
  it('lista só os convidados que precisam de transporte, no escopo', async () => {
    const a = await t.as<{ full_name: string }>(
      f.users.managerA,
      `select full_name from public.transport_list()`,
    )
    expect(a.map((r) => r.full_name)).toEqual(['Ausente Souza'])
    const admin = await t.as(f.users.admin, `select 1 from public.transport_list()`)
    expect(admin).toHaveLength(2)
  })
  it('Responsável atualiza situação e responsável pelo transporte do seu grupo (auditado)', async () => {
    const [row] = await t.as<{ request_id: string }>(
      f.users.leaderA1,
      `select request_id from public.transport_list()`,
    )
    await t.as(
      f.users.leaderA1,
      `update public.transport_requests set status = 'organizado', driver_name = 'Irmão José', pickup_point = 'Praça' where id = $1`,
      [row.request_id],
    )
    const [after] = await t.admin<{ status: string }>(
      `select status from public.transport_requests where id = $1`,
      [row.request_id],
    )
    expect(after.status).toBe('organizado')
    expect(
      await t.admin(`select 1 from public.audit_logs where table_name = 'transport_requests'`),
    ).not.toHaveLength(0)
  })
  it('Gestor A não altera transporte da igreja B', async () => {
    const [row] = await t.admin<{ id: string }>(
      `select t.id from public.transport_requests t join public.guests g on g.id = t.guest_id where g.church_id = $1`,
      [f.churchB],
    )
    await t.as(f.users.managerA, `update public.transport_requests set status = 'concluido' where id = $1`, [
      row.id,
    ])
    const [after] = await t.admin<{ status: string }>(
      `select status from public.transport_requests where id = $1`,
      [row.id],
    )
    expect(after.status).toBe('pendente')
  })
})

describe('auditoria de exportação', () => {
  it('Gestor exporta com telefone da própria igreja e fica registrado', async () => {
    await t.as(f.users.managerA, `select public.log_export('convidados', $1, $2, 2, true, '{}')`, [
      f.eventId,
      f.churchA,
    ])
    const [log] = await t.admin<{ action: string; user_id: string; new_data: { com_telefone: boolean } }>(
      `select action, user_id, new_data from public.audit_logs where action like 'exportacao.%'`,
    )
    expect(log.action).toBe('exportacao.convidados')
    expect(log.user_id).toBe(f.users.managerA)
    expect(log.new_data.com_telefone).toBe(true)
  })
  it('Responsável e Gestor de outra igreja não exportam com telefone', async () => {
    await expect(
      t.as(f.users.leaderA1, `select public.log_export('convidados', $1, $2, 1, true, '{}')`, [
        f.eventId,
        f.churchA,
      ]),
    ).rejects.toThrow(/apenas ao Gestor/)
    await expect(
      t.as(f.users.managerA, `select public.log_export('convidados', $1, $2, 1, true, '{}')`, [
        f.eventId,
        f.churchB,
      ]),
    ).rejects.toThrow(/apenas ao Gestor/)
    await expect(
      t.as(f.users.managerA, `select public.log_export('convidados', $1, null, 1, true, '{}')`, [f.eventId]),
    ).rejects.toThrow(/apenas ao Gestor/)
  })
  it('Responsável exporta sem telefone', async () => {
    await t.as(f.users.leaderA1, `select public.log_export('convidados', $1, $2, 1, false, '{}')`, [
      f.eventId,
      f.churchA,
    ])
  })
})
