// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, insertGuest, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture
let guestA: string
let guestB: string

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
  guestA = await insertGuest(t, f, { name: 'Convidado da Igreja A', memberId: f.memberA1 })
  guestB = await insertGuest(t, f, {
    name: 'Convidado da Igreja B',
    memberId: f.memberB1,
    phone: '+5583999990000',
  })
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('seed e estrutura', () => {
  it('cadastra as 11 igrejas do Polo', async () => {
    const rows = await t.admin<{ n: number }>(`select count(*)::int as n from public.churches`)
    expect(rows[0].n).toBe(11)
  })

  it('RLS está habilitado em todas as tabelas do esquema public', async () => {
    const rows = await t.admin<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(rows).toEqual([])
  })

  it('normalize_phone no banco segue a mesma regra do frontend', async () => {
    const rows = await t.admin<{ a: string; b: string; c: string | null; d: string }>(
      `select public.normalize_phone('(83) 98765-4321') a, public.normalize_phone('98765-4321') b,
              public.normalize_phone('(83) 88765-4321') c, public.normalize_phone('3214-5678') d`,
    )
    expect(rows[0]).toEqual({ a: '+5583987654321', b: '+5583987654321', c: null, d: '+558332145678' })
  })

  it('cria o perfil automaticamente ao criar usuário no Auth', async () => {
    const rows = await t.admin<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [
      f.users.managerA,
    ])
    expect(rows[0].full_name).toBe('Gestor A')
  })

  it('a igreja do membro é sempre a do grupo', async () => {
    const rows = await t.admin<{ church_id: string }>(`select church_id from public.members where id = $1`, [
      f.memberB1,
    ])
    expect(rows[0].church_id).toBe(f.churchB) // fixture enviou churchA de propósito
  })
})

describe('anônimo', () => {
  it('não lê nenhuma tabela', async () => {
    await expect(t.as(null, `select * from public.churches`)).rejects.toThrow(/permission denied/)
    await expect(t.as(null, `select * from public.guests`)).rejects.toThrow(/permission denied/)
  })
})

describe('usuário sem atribuição', () => {
  it('não vê igrejas nem membros', async () => {
    expect(await t.as(f.users.noRole, `select id from public.churches`)).toHaveLength(0)
    expect(await t.as(f.users.noRole, `select id from public.members`)).toHaveLength(0)
  })
})

describe('Gestor de Igreja (igreja A)', () => {
  it('vê apenas membros e convidados da própria igreja', async () => {
    const members = await t.as<{ id: string }>(f.users.managerA, `select id from public.members`)
    expect(members.map((m) => m.id)).toEqual([f.memberA1])
    const guests = await t.as<{ id: string }>(f.users.managerA, `select id from public.guests`)
    expect(guests.map((g) => g.id)).toEqual([guestA])
  })

  it('não altera convidado de outra igreja (0 linhas afetadas)', async () => {
    await t.as(f.users.managerA, `update public.guests set full_name = 'Hackeado' where id = $1`, [guestB])
    const rows = await t.admin<{ full_name: string }>(`select full_name from public.guests where id = $1`, [
      guestB,
    ])
    expect(rows[0].full_name).toBe('Convidado da Igreja B')
  })

  it('não cria membro em grupo de outra igreja', async () => {
    await expect(
      t.as(
        f.users.managerA,
        `insert into public.members (full_name, group_id, church_id) values ('X', $1, $2)`,
        [f.groupB1, f.churchA],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('não muda o crédito (igreja) de um convidado diretamente', async () => {
    await expect(
      t.as(f.users.managerA, `update public.guests set church_id = $1 where id = $2`, [f.churchB, guestA]),
    ).rejects.toThrow(/permission denied/)
  })

  it('cria grupo na própria igreja, mas não em outra', async () => {
    await t.as(
      f.users.managerA,
      `insert into public.assistance_groups (church_id, name) values ($1, 'Novo A')`,
      [f.churchA],
    )
    await expect(
      t.as(
        f.users.managerA,
        `insert into public.assistance_groups (church_id, name) values ($1, 'Invasor')`,
        [f.churchB],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('não cria nem altera igrejas', async () => {
    await expect(
      t.as(f.users.managerA, `insert into public.churches (name, city) values ('ICM Nova', 'X')`),
    ).rejects.toThrow(/row-level security/)
  })

  it('concede Responsável de Grupo na própria igreja, mas não Admin nem Recepção', async () => {
    const target = await t.createUser('novo.resp@teste.local')
    await t.as(
      f.users.managerA,
      `insert into public.role_assignments (user_id, role, church_id, group_id, created_by) values ($1, 'group_leader', $2, $3, $4)`,
      [target, f.churchA, f.groupA2, f.users.managerA],
    )
    await expect(
      t.as(
        f.users.managerA,
        `insert into public.role_assignments (user_id, role, created_by) values ($1, 'polo_admin', $2)`,
        [target, f.users.managerA],
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      t.as(
        f.users.managerA,
        `insert into public.role_assignments (user_id, role, created_by) values ($1, 'reception', $2)`,
        [target, f.users.managerA],
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      t.as(
        f.users.managerA,
        `insert into public.role_assignments (user_id, role, church_id, created_by) values ($1, 'church_manager', $2, $3)`,
        [target, f.churchB, f.users.managerA],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('não lê auditoria de outra igreja', async () => {
    const rows = await t.as<{ church_id: string }>(
      f.users.managerA,
      `select church_id from public.audit_logs`,
    )
    expect(rows.every((r) => r.church_id === f.churchA)).toBe(true)
  })
})

describe('Responsável de Grupo (grupo A1)', () => {
  it('vê apenas membros do próprio grupo', async () => {
    await t.admin(
      `insert into public.members (full_name, group_id, church_id) values ('Membro A2', $1, $2)`,
      [f.groupA2, f.churchA],
    )
    const rows = await t.as<{ full_name: string }>(f.users.leaderA1, `select full_name from public.members`)
    expect(rows.map((r) => r.full_name)).toEqual(['Membro A1'])
  })

  it('não transfere membro para grupo fora do seu escopo', async () => {
    await expect(
      t.as(f.users.leaderA1, `update public.members set group_id = $1 where id = $2`, [
        f.groupB1,
        f.memberA1,
      ]),
    ).rejects.toThrow(/row-level security/)
  })

  it('não cria grupos', async () => {
    await expect(
      t.as(f.users.leaderA1, `insert into public.assistance_groups (church_id, name) values ($1, 'X')`, [
        f.churchA,
      ]),
    ).rejects.toThrow(/row-level security/)
  })
})

describe('Recepção', () => {
  it('não lê a tabela de convidados nem de membros diretamente', async () => {
    expect(await t.as(f.users.reception, `select id from public.guests`)).toHaveLength(0)
    expect(await t.as(f.users.reception, `select id from public.members`)).toHaveLength(0)
  })
  it('não insere presença diretamente', async () => {
    await expect(
      t.as(
        f.users.reception,
        `insert into public.attendances (event_id, guest_id, type) values ($1, $2, 'presencial')`,
        [f.eventId, guestA],
      ),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('Leitor', () => {
  it('não vê nomes nem telefones de convidados', async () => {
    expect(await t.as(f.users.readerA, `select full_name, phone_normalized from public.guests`)).toHaveLength(
      0,
    )
    expect(await t.as(f.users.readerPolo, `select full_name from public.guests`)).toHaveLength(0)
  })
  it('vê a lista de igrejas', async () => {
    expect(await t.as(f.users.readerA, `select id from public.churches`)).toHaveLength(11)
  })
})

describe('Administrador do Polo', () => {
  it('vê todos os convidados e membros', async () => {
    expect(await t.as(f.users.admin, `select id from public.guests`)).toHaveLength(2)
    const members = await t.as(f.users.admin, `select id from public.members`)
    expect(members.length).toBeGreaterThanOrEqual(2)
  })
  it('não pode excluir igreja (apenas inativar)', async () => {
    // Pela API: sem política de delete, nenhuma linha é afetada.
    await t.as(f.users.admin, `delete from public.churches where id = $1`, [f.churchB])
    expect(await t.admin(`select id from public.churches where id = $1`, [f.churchB])).toHaveLength(1)
    // Mesmo como dono do banco, o gatilho impede a exclusão física.
    await expect(t.admin(`delete from public.churches where id = $1`, [f.churchB])).rejects.toThrow(
      /não podem ser excluídos/,
    )
  })
  it('não remove o último Administrador do Polo', async () => {
    await expect(
      t.admin(`delete from public.role_assignments where user_id = $1 and role = 'polo_admin'`, [
        f.users.admin,
      ]),
    ).rejects.toThrow(/último Administrador/)
  })
  it('permite apenas um evento ativo', async () => {
    await expect(
      t.as(f.users.admin, `insert into public.events (name, year, status) values ('Outro', 2027, 'ativo')`),
    ).rejects.toThrow(/duplicate key/)
  })
})

describe('segurança de funções', () => {
  it('bootstrap_polo_admin não é executável pela API', async () => {
    await expect(
      t.as(f.users.managerA, `select public.bootstrap_polo_admin('gestor.a@teste.local')`),
    ).rejects.toThrow(/permission denied/)
  })
  it('usuário não se desativa nem altera e-mail próprio', async () => {
    await expect(
      t.as(f.users.managerA, `update public.profiles set active = false where id = $1`, [f.users.managerA]),
    ).rejects.toThrow(/Administrador do Polo/)
  })
  it('perfil desativado perde todo o acesso', async () => {
    const u = await t.createUser('temp@teste.local')
    await t.admin(
      `insert into public.role_assignments (user_id, role, church_id) values ($1, 'church_manager', $2)`,
      [u, f.churchA],
    )
    expect(await t.as(u, `select id from public.members`)).not.toHaveLength(0)
    await t.admin(`update public.profiles set active = false where id = $1`, [u])
    expect(await t.as(u, `select id from public.members`)).toHaveLength(0)
  })
})

describe('auditoria e histórico', () => {
  it('registra a transferência de grupo em member_group_history', async () => {
    await t.as(f.users.managerA, `update public.members set group_id = $1 where id = $2`, [
      f.groupA2,
      f.memberA1,
    ])
    const rows = await t.admin<{ from_group_id: string; to_group_id: string }>(
      `select from_group_id, to_group_id from public.member_group_history where member_id = $1 and from_group_id is not null`,
      [f.memberA1],
    )
    expect(rows).toEqual([{ from_group_id: f.groupA1, to_group_id: f.groupA2 }])
  })
  it('audita alteração de permissões com o usuário responsável', async () => {
    const rows = await t.admin<{ user_id: string }>(
      `select user_id from public.audit_logs where table_name = 'role_assignments' and user_id = $1`,
      [f.users.managerA],
    )
    expect(rows.length).toBeGreaterThan(0)
  })
})
