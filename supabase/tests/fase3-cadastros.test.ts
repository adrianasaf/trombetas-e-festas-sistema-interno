// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('grupos', () => {
  it('nome é único dentro da igreja (sem diferenciar maiúsculas)', async () => {
    await expect(
      t.as(
        f.users.managerA,
        `insert into public.assistance_groups (church_id, name) values ($1, 'grupo a1')`,
        [f.churchA],
      ),
    ).rejects.toThrow(/duplicate key/)
  })

  it('o mesmo nome pode existir em outra igreja', async () => {
    await t.as(
      f.users.admin,
      `insert into public.assistance_groups (church_id, name) values ($1, 'Grupo A1')`,
      [f.churchB],
    )
  })

  it('grupo não muda de igreja', async () => {
    await expect(
      t.as(f.users.admin, `update public.assistance_groups set church_id = $1 where id = $2`, [
        f.churchB,
        f.groupA1,
      ]),
    ).rejects.toThrow(/não pode mudar de igreja/)
  })

  it('não aceita novo membro em grupo inativo', async () => {
    const [g] = await t.as<{ id: string }>(
      f.users.managerA,
      `insert into public.assistance_groups (church_id, name, active) values ($1, 'Inativo', false) returning id`,
      [f.churchA],
    )
    await expect(
      t.as(f.users.managerA, `insert into public.members (full_name, group_id) values ('Fulano', $1)`, [
        g.id,
      ]),
    ).rejects.toThrow(/inativo/)
  })
})

describe('membros', () => {
  it('Responsável cadastra membro no próprio grupo sem informar a igreja', async () => {
    const [m] = await t.as<{ church_id: string }>(
      f.users.leaderA1,
      `insert into public.members (full_name, group_id) values ('Novo do Grupo', $1) returning church_id`,
      [f.groupA1],
    )
    expect(m.church_id).toBe(f.churchA)
  })

  it('Responsável não cadastra membro em outro grupo da mesma igreja', async () => {
    await expect(
      t.as(f.users.leaderA1, `insert into public.members (full_name, group_id) values ('X', $1)`, [
        f.groupA2,
      ]),
    ).rejects.toThrow(/row-level security/)
  })

  it('inativar registra a data e reativar a limpa', async () => {
    const [m] = await t.as<{ inactivated_at: string | null }>(
      f.users.managerA,
      `update public.members set active = false where id = $1 returning inactivated_at`,
      [f.memberA1],
    )
    expect(m.inactivated_at).not.toBeNull()
    const [r] = await t.as<{ inactivated_at: string | null }>(
      f.users.managerA,
      `update public.members set active = true where id = $1 returning inactivated_at`,
      [f.memberA1],
    )
    expect(r.inactivated_at).toBeNull()
  })

  it('transferência entre igrejas pelo Admin muda a igreja e registra o histórico', async () => {
    const [m] = await t.admin<{ id: string }>(
      `insert into public.members (full_name, group_id) values ('Transferível', $1) returning id`,
      [f.groupA1],
    )
    const [after] = await t.as<{ church_id: string }>(
      f.users.admin,
      `update public.members set group_id = $1 where id = $2 returning church_id`,
      [f.groupB1, m.id],
    )
    expect(after.church_id).toBe(f.churchB)
    const hist = await t.admin<{ from_church_id: string | null; to_church_id: string }>(
      `select from_church_id, to_church_id from public.member_group_history where member_id = $1 order by changed_at`,
      [m.id],
    )
    expect(hist).toHaveLength(2)
    expect(hist[1]).toEqual({ from_church_id: f.churchA, to_church_id: f.churchB })
  })

  it('Gestor A não vê o histórico de membro de outra igreja', async () => {
    const rows = await t.as(
      f.users.managerA,
      `select h.id from public.member_group_history h
      join public.members m on m.id = h.member_id where m.id = $1`,
      [f.memberB1],
    )
    expect(rows).toHaveLength(0)
  })

  it('membro com convidado não pode ser excluído (histórico preservado)', async () => {
    await t.admin(
      `insert into public.guests (event_id, full_name, phone_normalized, category, mode, transport, church_id, group_id, member_id)
       values ($1, 'Convidado X', '+5583988887777', 'homem', 'presencial', 'meios_proprios', $2, $3, $4)`,
      [f.eventId, f.churchA, f.groupA1, f.memberA1],
    )
    await expect(
      t.as(f.users.managerA, `delete from public.members where id = $1`, [f.memberA1]),
    ).rejects.toThrow(/foreign key/)
  })
})

describe('visões agregadas', () => {
  it('Leitor da igreja A vê só a igreja A em church_overview', async () => {
    const rows = await t.as<{ id: string }>(f.users.readerA, `select id from public.church_overview()`)
    expect(rows.map((r) => r.id)).toEqual([f.churchA])
  })

  it('Leitor do Polo e Recepção veem as 11 igrejas', async () => {
    expect(await t.as(f.users.readerPolo, `select id from public.church_overview()`)).toHaveLength(11)
    expect(await t.as(f.users.reception, `select id from public.church_overview()`)).toHaveLength(11)
  })

  it('contagens de membros ativos por igreja', async () => {
    const [a] = await t.as<{ members_active: string }>(
      f.users.admin,
      `select members_active from public.church_overview() where id = $1`,
      [f.churchA],
    )
    expect(Number(a.members_active)).toBeGreaterThan(0)
  })

  it('Responsável vê o próprio grupo em group_overview', async () => {
    const rows = await t.as<{ id: string }>(f.users.leaderA1, `select id from public.group_overview(null)`)
    expect(rows.map((r) => r.id)).toContain(f.groupA1)
  })

  it('usuário sem perfil não vê nada', async () => {
    expect(await t.as(f.users.noRole, `select id from public.church_overview()`)).toHaveLength(0)
    expect(await t.as(f.users.noRole, `select id from public.group_overview(null)`)).toHaveLength(0)
  })

  it('anônimo não executa as visões', async () => {
    await expect(t.as(null, `select * from public.church_overview()`)).rejects.toThrow(/permission denied/)
  })
})
