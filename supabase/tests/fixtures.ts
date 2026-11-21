import type { TestDb } from './harness'

export interface Fixture {
  churchA: string
  churchB: string
  groupA1: string
  groupA2: string
  groupB1: string
  memberA1: string
  memberB1: string
  eventId: string
  users: {
    admin: string
    managerA: string
    leaderA1: string
    reception: string
    readerA: string
    readerPolo: string
    noRole: string
  }
}

/** Cenário padrão: duas igrejas (Manaíra = A, Geisel = B), grupos, membros e um usuário por perfil. */
export async function buildFixture(t: TestDb): Promise<Fixture> {
  const [a] = await t.admin<{ id: string }>(`select id from public.churches where name = 'ICM Manaíra'`)
  const [b] = await t.admin<{ id: string }>(`select id from public.churches where name = 'ICM Geisel'`)
  const group = async (church: string, name: string) =>
    (
      await t.admin<{ id: string }>(
        `insert into public.assistance_groups (church_id, name, leader_name) values ($1, $2, 'Resp.') returning id`,
        [church, name],
      )
    )[0].id
  const groupA1 = await group(a.id, 'Grupo A1')
  const groupA2 = await group(a.id, 'Grupo A2')
  const groupB1 = await group(b.id, 'Grupo B1')
  const member = async (groupId: string, name: string) =>
    (
      await t.admin<{ id: string }>(
        `insert into public.members (full_name, group_id, church_id) values ($1, $2, $3) returning id`,
        [name, groupId, a.id],
      )
    )[0].id
  const memberA1 = await member(groupA1, 'Membro A1')
  const memberB1 = await member(groupB1, 'Membro B1')

  const users = {
    admin: await t.createUser('admin@teste.local', 'Admin'),
    managerA: await t.createUser('gestor.a@teste.local', 'Gestor A'),
    leaderA1: await t.createUser('resp.a1@teste.local', 'Resp A1'),
    reception: await t.createUser('recepcao@teste.local', 'Recepção'),
    readerA: await t.createUser('leitor.a@teste.local', 'Leitor A'),
    readerPolo: await t.createUser('leitor.polo@teste.local', 'Leitor Polo'),
    noRole: await t.createUser('sem.perfil@teste.local', 'Sem perfil'),
  }
  await t.admin(`select public.bootstrap_polo_admin('admin@teste.local')`)
  const assign = (user: string, role: string, church: string | null, groupId: string | null) =>
    t.admin(
      `insert into public.role_assignments (user_id, role, church_id, group_id) values ($1, $2, $3, $4)`,
      [user, role, church, groupId],
    )
  await assign(users.managerA, 'church_manager', a.id, null)
  await assign(users.leaderA1, 'group_leader', a.id, groupA1)
  await assign(users.reception, 'reception', null, null)
  await assign(users.readerA, 'reader', a.id, null)
  await assign(users.readerPolo, 'reader', null, null)

  const [ev] = await t.admin<{ id: string }>(
    `insert into public.events (name, year, status) values ('Trombetas e Festas 2026', 2026, 'ativo') returning id`,
  )
  return {
    churchA: a.id,
    churchB: b.id,
    groupA1,
    groupA2,
    groupB1,
    memberA1,
    memberB1,
    eventId: ev.id,
    users,
  }
}

/** Insere convidado diretamente (como dono do banco), simulando o crédito do membro. */
export async function insertGuest(
  t: TestDb,
  f: Fixture,
  opts: { name: string; memberId: string; phone?: string; category?: string },
): Promise<string> {
  const [m] = await t.admin<{ church_id: string; group_id: string }>(
    `select church_id, group_id from public.members where id = $1`,
    [opts.memberId],
  )
  const [g] = await t.admin<{ id: string }>(
    `insert into public.guests (event_id, full_name, phone_normalized, category, mode, transport, church_id, group_id, member_id)
     values ($1, $2, $3, $4, 'presencial', 'meios_proprios', $5, $6, $7) returning id`,
    [
      f.eventId,
      opts.name,
      opts.phone ?? '+5583987654321',
      opts.category ?? 'homem',
      m.church_id,
      m.group_id,
      opts.memberId,
    ],
  )
  return g.id
}
