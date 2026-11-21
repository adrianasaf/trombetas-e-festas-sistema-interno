// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture

async function guest(
  member: string,
  name: string,
  phone: string,
  category = 'mulher',
  transport = 'meios_proprios',
) {
  const [r] = await t.as<{ r: { id: string } }>(
    f.users.admin,
    `select public.create_guest(p_member_id => $1, p_full_name => $2, p_phone => $3, p_category => $4::public.guest_category,
      p_consent => true, p_mode => 'presencial', p_transport => $5::public.transport_need) as r`,
    [member, name, phone, category, transport],
  )
  return r.r.id
}

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
  const g1 = await guest(f.memberA1, 'Ana Paula Souza', '83981230001', 'mulher')
  await guest(f.memberA1, 'Bruno Costa Lima', '83981230002', 'homem', 'precisa_transporte')
  await guest(f.memberB1, 'Carla Dias Rocha', '83981230003', 'mulher')
  // Cadastro "ontem" (23h30 em Fortaleza = 02h30 UTC de hoje) para testar o fuso.
  await t.admin(`update public.guests set created_at = date_trunc('day', now() at time zone 'America/Fortaleza')
    at time zone 'America/Fortaleza' - interval '30 minutes' where full_name = 'Carla Dias Rocha'`)
  await t.as(f.users.reception, `select public.check_in($1)`, [g1])
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('evolução diária', () => {
  it('agrupa pelo dia de Fortaleza, não pelo dia UTC', async () => {
    const rows = await t.as<{ day: string; invites: number; attendances: number }>(
      f.users.admin,
      `select day::text, invites, attendances from public.stats_daily($1)`,
      [f.eventId],
    )
    expect(rows).toHaveLength(2)
    expect(Number(rows[0].invites)).toBe(1) // ontem: Carla
    expect(Number(rows[1].invites)).toBe(2)
    expect(Number(rows[1].attendances)).toBe(1)
  })
  it('respeita o escopo: Leitor A vê a igreja A, não o Polo', async () => {
    expect(await t.as(f.users.readerA, `select * from public.stats_daily($1)`, [f.eventId])).toHaveLength(0)
    const a = await t.as<{ invites: number }>(f.users.readerA, `select * from public.stats_daily($1, $2)`, [
      f.eventId,
      f.churchA,
    ])
    expect(a.reduce((s, r) => s + Number(r.invites), 0)).toBe(2)
  })
})

describe('categorias e transporte', () => {
  it('conta convidados e presentes por categoria', async () => {
    const rows = await t.as<{ category: string; guests: number; present: number }>(
      f.users.admin,
      `select category::text, guests, present from public.stats_categories($1)`,
      [f.eventId],
    )
    const mulher = rows.find((r) => r.category === 'mulher')!
    expect(Number(mulher.guests)).toBe(2)
    expect(Number(mulher.present)).toBe(1)
  })
  it('situação do transporte por igreja', async () => {
    const rows = await t.as<{ status: string; total: number }>(
      f.users.managerA,
      `select status::text, total from public.stats_transport($1, $2)`,
      [f.eventId, f.churchA],
    )
    expect(rows).toEqual([{ status: 'pendente', total: rows[0] ? rows[0].total : 0 }])
    expect(Number(rows[0].total)).toBe(1)
  })
  it('Gestor A não vê transporte da igreja B', async () => {
    expect(
      await t.as(f.users.managerA, `select * from public.stats_transport($1, $2)`, [f.eventId, f.churchB]),
    ).toHaveLength(0)
  })
})
