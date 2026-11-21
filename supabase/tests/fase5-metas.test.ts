// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture
let churchC: string
let groupC: string
const membersC: string[] = []

interface Summary {
  members_goal_base: string
  invites_goal: string
  attendance_goal: string
  guests_unique: string
  present_unique: string
  pct_invites: string | null
  pct_attendance: string | null
  online_registered: string
  online_only: string
  reach_total: string
  need_transport: string
  confirmed: string
  online_confirmed: string
  members_met_invites: string
  members_below_invites: string
  members_met_attendance: string
  members_below_attendance: string
}

async function summary(
  user: string,
  church: string | null,
  group: string | null = null,
): Promise<Summary | undefined> {
  const rows = await t.as<Summary>(user, `select * from public.goal_summary($1, $2, $3)`, [
    f.eventId,
    church,
    group,
  ])
  return rows[0]
}

async function addMembers(n: number) {
  for (let i = 0; i < n; i++) {
    const [m] = await t.admin<{ id: string }>(
      `insert into public.members (full_name, group_id) values ($1, $2) returning id`,
      [`Membro C${membersC.length + 1}`, groupC],
    )
    membersC.push(m.id)
  }
}

let phoneSeq = 1000
async function guestFor(memberId: string, opts: { mode?: string; transport?: string; status?: string } = {}) {
  const [g] = await t.as<{ r: { id: string } }>(
    f.users.admin,
    `select public.create_guest(p_member_id => $1, p_full_name => $2, p_phone => $3, p_category => 'mulher',
       p_consent => true, p_mode => $4::public.participation_mode, p_transport => $5::public.transport_need,
       p_invite_status => $6::public.invite_status) as r`,
    [
      memberId,
      `Convidada Unica ${phoneSeq}`,
      `839${String(80000000 + phoneSeq++)}`,
      opts.mode ?? 'presencial',
      opts.transport ?? 'meios_proprios',
      opts.status ?? 'convidado',
    ],
  )
  return g.r.id
}

async function attend(guestId: string, type: 'presencial' | 'online') {
  await t.admin(`insert into public.attendances (event_id, guest_id, type) values ($1, $2, $3)`, [
    f.eventId,
    guestId,
    type,
  ])
}

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
  const [c] = await t.admin<{ id: string }>(`select id from public.churches where name = 'ICM Bessa'`)
  churchC = c.id
  const [g] = await t.admin<{ id: string }>(
    `insert into public.assistance_groups (church_id, name) values ($1, 'Grupo C') returning id`,
    [churchC],
  )
  groupC = g.id
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('fórmulas (seção 10)', () => {
  it.each([
    [20, 60, 20],
    [30, 90, 30],
    [50, 150, 50],
  ])('%i membros ativos → meta de convites %i e meta presencial %i', async (n, inv, att) => {
    await addMembers(n - membersC.length)
    const s = await summary(f.users.admin, churchC)
    expect(Number(s!.members_goal_base)).toBe(n)
    expect(Number(s!.invites_goal)).toBe(inv)
    expect(Number(s!.attendance_goal)).toBe(att)
  })

  it('percentuais sobre convidados únicos e presenças presenciais', async () => {
    // 50 membros → metas 150/50. 15 convidados, 5 presentes → 10% e 10%.
    const ids: string[] = []
    for (let i = 0; i < 15; i++) ids.push(await guestFor(membersC[i % 5]))
    for (let i = 0; i < 5; i++) await attend(ids[i], 'presencial')
    const s = await summary(f.users.admin, churchC)
    expect(Number(s!.guests_unique)).toBe(15)
    expect(Number(s!.present_unique)).toBe(5)
    expect(Number(s!.pct_invites)).toBe(10)
    expect(Number(s!.pct_attendance)).toBe(10)
  })

  it('membros que cumpriram a meta (≥3 convidados, ≥1 presente)', async () => {
    const s = await summary(f.users.admin, churchC)
    expect(Number(s!.members_met_invites)).toBe(5) // membros 0..4 têm 3 convidados cada
    expect(Number(s!.members_below_invites)).toBe(45)
    expect(Number(s!.members_met_attendance)).toBe(5)
  })

  it('online é separado do presencial; presencial+online conta só como presencial no alcance', async () => {
    const onlineOnly = await guestFor(membersC[10], { mode: 'online', status: 'confirmou' })
    await attend(onlineOnly, 'online')
    const [both] = await t.admin<{ id: string }>(
      `select id from public.guests where church_id = $1 and id in (
         select guest_id from public.attendances where type = 'presencial') limit 1`,
      [churchC],
    )
    await attend(both.id, 'online')
    const s = await summary(f.users.admin, churchC)
    expect(Number(s!.present_unique)).toBe(5) // online não soma ao presencial
    expect(Number(s!.online_registered)).toBe(2)
    expect(Number(s!.online_only)).toBe(1)
    expect(Number(s!.reach_total)).toBe(6) // 5 presenciais + 1 só online
    expect(Number(s!.online_confirmed)).toBe(1)
  })

  it('presença revogada não conta', async () => {
    const g = await guestFor(membersC[20])
    await attend(g, 'presencial')
    expect(Number((await summary(f.users.admin, churchC))!.present_unique)).toBe(6)
    await t.admin(
      `update public.attendances set revoked_at = now(), revoke_reason = 'engano' where guest_id = $1`,
      [g],
    )
    expect(Number((await summary(f.users.admin, churchC))!.present_unique)).toBe(5)
  })

  it('transporte e confirmados', async () => {
    await guestFor(membersC[30], { transport: 'precisa_transporte', status: 'confirmou' })
    const s = await summary(f.users.admin, churchC)
    expect(Number(s!.need_transport)).toBe(1)
    expect(Number(s!.confirmed)).toBe(1)
  })
})

describe('data de corte e snapshot', () => {
  it('antes do corte, inativar um membro reduz a meta ao vivo', async () => {
    await t.admin(`update public.members set active = false where id = $1`, [membersC[49]])
    expect(Number((await summary(f.users.admin, churchC))!.members_goal_base)).toBe(49)
    await t.admin(`update public.members set active = true where id = $1`, [membersC[49]])
  })

  it('ao chegar a data de corte, grava o snapshot (corte no passado ao salvar)', async () => {
    await t.admin(`update public.events set cutoff_at = now() - interval '1 minute' where id = $1`, [
      f.eventId,
    ])
    const [e] = await t.admin<{ snapshot_taken_at: string | null }>(
      `select snapshot_taken_at from public.events where id = $1`,
      [f.eventId],
    )
    expect(e.snapshot_taken_at).not.toBeNull()
    const [n] = await t.admin<{ n: number }>(
      `select count(*)::int n from public.goal_snapshots where event_id = $1 and church_id = $2`,
      [f.eventId, churchC],
    )
    expect(n.n).toBe(50)
  })

  it('depois do corte, membro inativado continua na meta e mantém resultados', async () => {
    await t.admin(`update public.members set active = false where id = $1`, [membersC[0]])
    const s = await summary(f.users.admin, churchC)
    expect(Number(s!.members_goal_base)).toBe(50)
    expect(Number(s!.invites_goal)).toBe(150)
    expect(Number(s!.guests_unique)).toBeGreaterThanOrEqual(15)
  })

  it('membro novo depois do corte entra com meta zero, mas seus convites contam', async () => {
    const before = await summary(f.users.admin, churchC)
    const [m] = await t.admin<{ id: string }>(
      `insert into public.members (full_name, group_id) values ('Membro Novo', $1) returning id`,
      [groupC],
    )
    await guestFor(m.id)
    const after = await summary(f.users.admin, churchC)
    expect(after!.invites_goal).toBe(before!.invites_goal)
    expect(Number(after!.guests_unique)).toBe(Number(before!.guests_unique) + 1)
    const [ms] = await t.as<{ in_goal: boolean; invites_goal: number; invited: string | number }>(
      f.users.admin,
      `select in_goal, invites_goal, invited from public.member_goal_stats($1, null, $2)`,
      [f.eventId, m.id],
    )
    expect({ ...ms, invited: Number(ms.invited) }).toEqual({ in_goal: false, invites_goal: 0, invited: 1 })
  })

  it('transferência depois do corte: meta fica no grupo do snapshot; convites antigos no grupo de origem', async () => {
    const [g2] = await t.admin<{ id: string }>(
      `insert into public.assistance_groups (church_id, name) values ($1, 'Grupo C2') returning id`,
      [churchC],
    )
    await t.admin(`update public.members set group_id = $1 where id = $2`, [g2.id, membersC[1]])
    const sC = await summary(f.users.admin, churchC, groupC)
    const sC2 = await summary(f.users.admin, churchC, g2.id)
    expect(Number(sC!.members_goal_base)).toBe(50)
    expect(Number(sC2!.members_goal_base)).toBe(0)
    expect(Number(sC2!.guests_unique)).toBe(0)
  })

  it('somente o Admin grava ou refaz o snapshot manualmente', async () => {
    await expect(
      t.as(f.users.managerA, `select public.take_goal_snapshot_now($1)`, [f.eventId]),
    ).rejects.toThrow(/Somente o Administrador/)
    await expect(
      t.as(f.users.admin, `select public.take_goal_snapshot_now($1)`, [f.eventId]),
    ).rejects.toThrow(/já foi gravado/)
    const [r] = await t.as<{ n: number }>(f.users.admin, `select public.take_goal_snapshot_now($1, true) n`, [
      f.eventId,
    ])
    expect(r.n).toBeGreaterThan(0)
  })
})

describe('escopo das estatísticas', () => {
  it('Leitor A vê a igreja A, mas não a igreja C nem o Polo', async () => {
    expect(await summary(f.users.readerA, f.churchA)).toBeDefined()
    expect(await summary(f.users.readerA, churchC)).toBeUndefined()
    expect(await summary(f.users.readerA, null)).toBeUndefined()
  })
  it('Gestor A não vê o Polo; Leitor do Polo e Recepção veem', async () => {
    expect(await summary(f.users.managerA, null)).toBeUndefined()
    expect(await summary(f.users.readerPolo, null)).toBeDefined()
    expect(await summary(f.users.reception, null)).toBeDefined()
  })
  it('Leitor não acessa desempenho por membro (nomes)', async () => {
    expect(
      await t.as(f.users.readerPolo, `select * from public.member_goal_stats($1)`, [f.eventId]),
    ).toHaveLength(0)
  })
  it('Responsável vê o próprio grupo por membro', async () => {
    const rows = await t.as<{ full_name: string }>(
      f.users.leaderA1,
      `select full_name from public.member_goal_stats($1, $2)`,
      [f.eventId, f.groupA1],
    )
    expect(rows.map((r) => r.full_name)).toContain('Membro A1')
  })
  it('goal_by_church lista só as igrejas do escopo', async () => {
    expect(
      await t.as(f.users.readerA, `select church_id from public.goal_by_church($1)`, [f.eventId]),
    ).toHaveLength(1)
    expect(
      await t.as(f.users.admin, `select church_id from public.goal_by_church($1)`, [f.eventId]),
    ).toHaveLength(11)
  })
})
