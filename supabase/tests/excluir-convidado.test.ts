// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture

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
}, 60_000)
afterAll(async () => {
  await t?.close()
})

describe('excluir convidado', () => {
  it('sem presença: Responsável do grupo exclui sem motivo', async () => {
    const g = await guest('Sem Presenca Um', '83981260001')
    await t.as(f.users.leaderA1, `select public.delete_guest($1)`, [g])
    expect(await t.admin(`select 1 from public.guests where id = $1`, [g])).toHaveLength(0)
  })

  it('com presença: Responsável e Recepção não excluem', async () => {
    const g = await guest('Com Presenca Dois', '83981260002')
    await t.as(f.users.reception, `select public.check_in($1)`, [g])
    await expect(t.as(f.users.leaderA1, `select public.delete_guest($1, 'erro')`, [g])).rejects.toThrow(
      /Gestor da igreja/,
    )
    await expect(t.as(f.users.reception, `select public.delete_guest($1, 'erro')`, [g])).rejects.toThrow(
      /Gestor da igreja/,
    )
  })

  it('com presença: Gestor exige motivo e exclui convidado e presença, com auditoria', async () => {
    const g = await guest('Com Presenca Tres', '83981260003')
    await t.as(f.users.reception, `select public.check_in($1)`, [g])
    await expect(t.as(f.users.managerA, `select public.delete_guest($1)`, [g])).rejects.toThrow(/motivo/)
    await t.as(f.users.managerA, `select public.delete_guest($1, 'Cadastro em duplicidade')`, [g])
    expect(await t.admin(`select 1 from public.guests where id = $1`, [g])).toHaveLength(0)
    expect(await t.admin(`select 1 from public.attendances where guest_id = $1`, [g])).toHaveLength(0)
    const [log] = await t.admin<{ new_data: { motivo: string; presencas_apagadas: number } }>(
      `select new_data from public.audit_logs where action = 'guests.excluir' and record_id = $1`,
      [g],
    )
    expect(log.new_data.motivo).toBe('Cadastro em duplicidade')
    expect(log.new_data.presencas_apagadas).toBe(1)
  })

  it('Gestor de outra igreja não exclui', async () => {
    const [b] = await t.as<{ r: { id: string } }>(
      f.users.admin,
      `select public.create_guest(p_member_id => $1, p_full_name => 'Da Igreja B', p_phone => '83981260004',
        p_category => 'homem', p_consent => true) as r`,
      [f.memberB1],
    )
    await expect(t.as(f.users.managerA, `select public.delete_guest($1, 'x y z')`, [b.r.id])).rejects.toThrow(
      /permissão/,
    )
  })

  it('anônimo não executa', async () => {
    await expect(t.as(null, `select public.delete_guest(gen_random_uuid())`)).rejects.toThrow(
      /permission denied/,
    )
  })
})
