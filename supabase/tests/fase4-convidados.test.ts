// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture
let memberA2: string

interface Created {
  id: string
  possible_duplicate: boolean
  duplicates: number
}

async function createGuest(
  user: string,
  args: {
    member: string
    name: string
    phone?: string | null
    category?: string
    consent?: boolean
    mode?: string
    transport?: string
    guardianName?: string | null
    guardianPhone?: string | null
    notes?: string | null
  },
): Promise<Created> {
  const rows = await t.as<{ r: Created }>(
    user,
    `select public.create_guest(
       p_member_id => $1, p_full_name => $2, p_phone => $3, p_category => $4::public.guest_category,
       p_consent => $5, p_mode => $6::public.participation_mode, p_transport => $7::public.transport_need,
       p_guardian_name => $8, p_guardian_phone => $9, p_notes => $10) as r`,
    [
      args.member,
      args.name,
      args.phone ?? null,
      args.category ?? 'homem',
      args.consent ?? true,
      args.mode ?? 'presencial',
      args.transport ?? 'meios_proprios',
      args.guardianName ?? null,
      args.guardianPhone ?? null,
      args.notes ?? null,
    ],
  )
  return rows[0].r
}

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
  const [m] = await t.admin<{ id: string }>(
    `insert into public.members (full_name, group_id) values ('Membro A2', $1) returning id`,
    [f.groupA2],
  )
  memberA2 = m.id
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('cadastro de convidado', () => {
  it('copia igreja e grupo do membro e grava o snapshot em guest_referrals', async () => {
    const r = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'João da Silva',
      phone: '(83) 98111-0001',
    })
    const [g] = await t.admin<{
      church_id: string
      group_id: string
      member_id: string
      phone_normalized: string
    }>(`select church_id, group_id, member_id, phone_normalized from public.guests where id = $1`, [r.id])
    expect(g).toEqual({
      church_id: f.churchA,
      group_id: f.groupA1,
      member_id: f.memberA1,
      phone_normalized: '+5583981110001',
    })
    const refs = await t.admin(`select * from public.guest_referrals where guest_id = $1 and is_primary`, [
      r.id,
    ])
    expect(refs).toHaveLength(1)
  })

  it('grava o consentimento com data, hora e usuário', async () => {
    const r = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'Maria Souza',
      phone: '83981110002',
    })
    const [c] = await t.admin<{ recorded_by: string; given_by_guardian: boolean; consented_at: string }>(
      `select recorded_by, given_by_guardian, consented_at from public.guest_consents where guest_id = $1`,
      [r.id],
    )
    expect(c.recorded_by).toBe(f.users.leaderA1)
    expect(c.given_by_guardian).toBe(false)
    expect(c.consented_at).toBeTruthy()
  })

  it('exige consentimento', async () => {
    await expect(
      createGuest(f.users.leaderA1, {
        member: f.memberA1,
        name: 'Sem Consentimento',
        phone: '83981110003',
        consent: false,
      }),
    ).rejects.toThrow(/consentimento do convidado/)
  })

  it('exige telefone para adulto e valida o formato', async () => {
    await expect(createGuest(f.users.leaderA1, { member: f.memberA1, name: 'Sem Telefone' })).rejects.toThrow(
      /telefone é obrigatório/,
    )
    await expect(
      createGuest(f.users.leaderA1, { member: f.memberA1, name: 'Telefone Ruim', phone: '1234' }),
    ).rejects.toThrow(/Telefone inválido/)
  })

  it('criança sem telefone próprio, com responsável legal e consentimento do responsável', async () => {
    const r = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'Pedrinho Lima',
      category: 'crianca',
      guardianName: 'Ana Lima',
      guardianPhone: '(83) 98111-0004',
    })
    const [g] = await t.admin<{ phone_normalized: string | null; guardian_phone: string }>(
      `select phone_normalized, guardian_phone from public.guests where id = $1`,
      [r.id],
    )
    expect(g).toEqual({ phone_normalized: null, guardian_phone: '+5583981110004' })
    const [c] = await t.admin<{ given_by_guardian: boolean; guardian_name: string; consent_text: string }>(
      `select given_by_guardian, guardian_name, consent_text from public.guest_consents where guest_id = $1`,
      [r.id],
    )
    expect(c.given_by_guardian).toBe(true)
    expect(c.guardian_name).toBe('Ana Lima')
    expect(c.consent_text).toMatch(/art\. 14/)
  })

  it('criança sem responsável é recusada', async () => {
    await expect(
      createGuest(f.users.leaderA1, { member: f.memberA1, name: 'Sem Responsável', category: 'adolescente' }),
    ).rejects.toThrow(/responsável legal/)
  })

  it('modalidade online zera o transporte', async () => {
    const r = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'Online Teste',
      phone: '83981110005',
      mode: 'online',
      transport: 'precisa_transporte',
    })
    const [g] = await t.admin<{ transport: string | null }>(
      `select transport from public.guests where id = $1`,
      [r.id],
    )
    expect(g.transport).toBeNull()
    expect(await t.admin(`select * from public.transport_requests where guest_id = $1`, [r.id])).toHaveLength(
      0,
    )
  })

  it('"precisa de transporte" cria solicitação; mudar para online cancela', async () => {
    const r = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'Precisa Carona',
      phone: '83981110006',
      transport: 'precisa_transporte',
    })
    const [tr] = await t.admin<{ status: string; cancelled_at: string | null }>(
      `select status, cancelled_at from public.transport_requests where guest_id = $1`,
      [r.id],
    )
    expect(tr).toEqual({ status: 'pendente', cancelled_at: null })
    await t.as(f.users.leaderA1, `update public.guests set mode = 'online' where id = $1`, [r.id])
    const [after] = await t.admin<{ cancelled_at: string | null }>(
      `select cancelled_at from public.transport_requests where guest_id = $1`,
      [r.id],
    )
    expect(after.cancelled_at).not.toBeNull()
  })

  it('observações com mais de 500 caracteres são recusadas', async () => {
    await expect(
      createGuest(f.users.leaderA1, {
        member: f.memberA1,
        name: 'Notas Longas',
        phone: '83981110007',
        notes: 'x'.repeat(501),
      }),
    ).rejects.toThrow(/500 caracteres/)
  })

  it('Responsável A1 não cadastra convidado para membro do grupo A2 nem da igreja B', async () => {
    await expect(
      createGuest(f.users.leaderA1, { member: memberA2, name: 'Fora do Grupo', phone: '83981110008' }),
    ).rejects.toThrow(/permissão/)
    await expect(
      createGuest(f.users.managerA, { member: f.memberB1, name: 'Outra Igreja', phone: '83981110009' }),
    ).rejects.toThrow(/permissão/)
  })

  it('Recepção e Leitor não usam create_guest para membros', async () => {
    await expect(
      createGuest(f.users.reception, { member: f.memberA1, name: 'Pela Recepção', phone: '83981110010' }),
    ).rejects.toThrow(/permissão/)
    await expect(
      createGuest(f.users.readerA, { member: f.memberA1, name: 'Pelo Leitor', phone: '83981110011' }),
    ).rejects.toThrow(/permissão/)
  })

  it('membro inativo não recebe novos convites', async () => {
    const [m] = await t.admin<{ id: string }>(
      `insert into public.members (full_name, group_id, active, inactivated_at) values ('Inativo', $1, false, current_date) returning id`,
      [f.groupA1],
    )
    await expect(
      createGuest(f.users.managerA, { member: m.id, name: 'Convite de Inativo', phone: '83981110013' }),
    ).rejects.toThrow(/inativo/)
  })

  it('edição encerrada é somente leitura', async () => {
    const [ev] = await t.admin<{ id: string }>(
      `insert into public.events (name, year, status) values ('Edição antiga', 2025, 'encerrado') returning id`,
    )
    await expect(
      t.as(
        f.users.admin,
        `select public.create_guest(p_member_id => $1, p_full_name => 'Antigo', p_phone => '83981110012',
          p_category => 'homem', p_consent => true, p_event_id => $2)`,
        [f.memberA1, ev.id],
      ),
    ).rejects.toThrow(/encerrada/)
  })
})

describe('duplicidades e crédito', () => {
  let first: Created
  let second: Created

  it('mesmo telefone não bloqueia, mas marca possível duplicidade', async () => {
    first = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'Carlos Alberto Pereira',
      phone: '83981119999',
    })
    expect(first.possible_duplicate).toBe(false)
    second = await createGuest(f.users.managerA, {
      member: memberA2,
      name: 'Carlos A. Pereira',
      phone: '(83) 98111-9999',
    })
    expect(second.possible_duplicate).toBe(true)
    const [d] = await t.admin<{ reason: string; status: string }>(
      `select reason, status from public.duplicate_reviews where guest_id = $1`,
      [second.id],
    )
    expect(d.status).toBe('pendente')
    expect(d.reason).toMatch(/Mesmo telefone/)
  })

  it('família com o mesmo telefone também vai para revisão, com motivo diferente', async () => {
    const r = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'Beatriz Gomes',
      phone: '83981119999',
    })
    const reasons = await t.admin<{ reason: string }>(
      `select reason from public.duplicate_reviews where guest_id = $1`,
      [r.id],
    )
    expect(reasons.some((x) => /família/.test(x.reason))).toBe(true)
  })

  it('Responsável de Grupo não vê a fila de revisão', async () => {
    expect(
      await t.as(f.users.leaderA1, `select * from public.list_duplicate_reviews(null, 'pendente')`),
    ).toHaveLength(0)
    expect(
      await t.as(f.users.managerA, `select * from public.list_duplicate_reviews(null, 'pendente')`),
    ).not.toHaveLength(0)
  })

  it('Responsável não consegue mesclar', async () => {
    const [d] = await t.admin<{ id: string }>(`select id from public.duplicate_reviews where guest_id = $1`, [
      second.id,
    ])
    await expect(
      t.as(f.users.leaderA1, `select public.merge_guests($1, $2)`, [d.id, second.id]),
    ).rejects.toThrow(/acesso às igrejas/)
  })

  it('mescla mantém o crédito com o PRIMEIRO cadastro, mesmo mantendo o registro mais novo', async () => {
    const [d] = await t.admin<{ id: string }>(
      `select id from public.duplicate_reviews where guest_id = $1 and candidate_guest_id = $2`,
      [second.id, first.id],
    )
    await t.as(f.users.managerA, `select public.merge_guests($1, $2, 'mesma pessoa')`, [d.id, second.id])
    const [kept] = await t.admin<{ member_id: string; group_id: string; merged_into_id: string | null }>(
      `select member_id, group_id, merged_into_id from public.guests where id = $1`,
      [second.id],
    )
    expect(kept).toEqual({ member_id: f.memberA1, group_id: f.groupA1, merged_into_id: null })
    const [dropped] = await t.admin<{ merged_into_id: string }>(
      `select merged_into_id from public.guests where id = $1`,
      [first.id],
    )
    expect(dropped.merged_into_id).toBe(second.id)
    const refs = await t.admin(`select id from public.guest_referrals where guest_id = $1`, [second.id])
    expect(refs).toHaveLength(2)
  })

  it('registro mesclado não conta duas vezes (somente 1 ativo para o telefone)', async () => {
    const rows = await t.admin<{ n: number }>(
      `select count(*)::int n from public.guests where phone_normalized = '+5583981119999' and merged_into_id is null
       and full_name like 'Carlos%'`,
    )
    expect(rows[0].n).toBe(1)
  })

  it('mescla é auditada', async () => {
    const rows = await t.admin(`select * from public.audit_logs where action = 'duplicidade.mesclar'`)
    expect(rows).toHaveLength(1)
  })

  it('"pessoas diferentes" resolve a revisão e limpa a marcação', async () => {
    const pend = await t.admin<{ id: string; guest_id: string }>(
      `select id, guest_id from public.duplicate_reviews where status = 'pendente' limit 1`,
    )
    await t.as(f.users.managerA, `select public.resolve_duplicate_distinct($1, 'irmãos')`, [pend[0].id])
    const [d] = await t.admin<{ status: string }>(
      `select status from public.duplicate_reviews where id = $1`,
      [pend[0].id],
    )
    expect(d.status).toBe('pessoas_diferentes')
  })

  it('reatribuição de crédito exige justificativa e é auditada', async () => {
    await expect(
      t.as(f.users.managerA, `select public.reassign_guest_credit($1, $2, 'curta')`, [second.id, memberA2]),
    ).rejects.toThrow(/justificativa/)
    await t.as(
      f.users.managerA,
      `select public.reassign_guest_credit($1, $2, 'Membro A2 fez o convite de fato')`,
      [second.id, memberA2],
    )
    const [g] = await t.admin<{ member_id: string; group_id: string }>(
      `select member_id, group_id from public.guests where id = $1`,
      [second.id],
    )
    expect(g).toEqual({ member_id: memberA2, group_id: f.groupA2 })
    const logs = await t.admin<{ new_data: { justificativa: string } }>(
      `select new_data from public.audit_logs where action = 'credito.reatribuir'`,
    )
    expect(logs[0].new_data.justificativa).toMatch(/fez o convite/)
  })

  it('Responsável não reatribui crédito', async () => {
    await expect(
      t.as(
        f.users.leaderA1,
        `select public.reassign_guest_credit($1, $2, 'justificativa longa o bastante')`,
        [second.id, f.memberA1],
      ),
    ).rejects.toThrow(/Somente o Gestor/)
  })

  it('transferir o membro depois NÃO altera o crédito de convites antigos', async () => {
    const r = await createGuest(f.users.leaderA1, {
      member: f.memberA1,
      name: 'Antes da Transferência',
      phone: '83981118888',
    })
    await t.admin(`update public.members set group_id = $1 where id = $2`, [f.groupA2, f.memberA1])
    const [g] = await t.admin<{ group_id: string }>(`select group_id from public.guests where id = $1`, [
      r.id,
    ])
    expect(g.group_id).toBe(f.groupA1)
    await t.admin(`update public.members set group_id = $1 where id = $2`, [f.groupA1, f.memberA1])
  })
})
