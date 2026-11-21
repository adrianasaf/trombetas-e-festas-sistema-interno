// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'
import { buildFixture, type Fixture } from './fixtures'

let t: TestDb
let f: Fixture
let guestA: string
let guestB: string

interface CheckResult {
  status: 'registrada' | 'ja_registrada'
  checked_in_at: string
  checked_in_by: string
  repetida?: boolean
  guest_id?: string
}

async function newGuest(name: string, phone: string, member = f.memberA1) {
  const [r] = await t.as<{ r: { id: string } }>(
    f.users.admin,
    `select public.create_guest(p_member_id => $1, p_full_name => $2, p_phone => $3, p_category => 'homem',
      p_consent => true, p_mode => 'presencial') as r`,
    [member, name, phone],
  )
  return r.r.id
}

const checkIn = async (user: string, guest: string, req: string | null = null, type = 'presencial') =>
  (
    await t.as<{ r: CheckResult }>(user, `select public.check_in($1, $2, $3::public.attendance_type) as r`, [
      guest,
      req,
      type,
    ])
  )[0].r

beforeAll(async () => {
  t = await createTestDb()
  f = await buildFixture(t)
  guestA = await newGuest('Raimundo Nonato Ferreira', '(83) 98765-1234')
  guestB = await newGuest('Josefa Maria da Conceição', '(83) 99999-5678', f.memberB1)
}, 60_000)

afterAll(async () => {
  await t?.close()
})

describe('busca do check-in', () => {
  it('Recepção encontra por nome (sem acento) com telefone mascarado e dados de vínculo', async () => {
    const rows = await t.as<{
      full_name: string
      phone_masked: string
      church_name: string
      member_name: string
    }>(f.users.reception, `select * from public.search_checkin('josefa conceicao')`)
    expect(rows).toHaveLength(1)
    expect(rows[0].phone_masked).toBe('(83) 9****-5678')
    expect(rows[0].church_name).toBe('ICM Geisel')
    expect(rows[0].member_name).toBe('Membro B1')
  })

  it('encontra pelos últimos dígitos do telefone', async () => {
    const rows = await t.as<{ full_name: string }>(
      f.users.reception,
      `select * from public.search_checkin('1234')`,
    )
    expect(rows.map((r) => r.full_name)).toContain('Raimundo Nonato Ferreira')
  })

  it('o resultado nunca traz o telefone completo', async () => {
    const rows = await t.as<Record<string, unknown>>(
      f.users.reception,
      `select * from public.search_checkin('raimundo')`,
    )
    expect(JSON.stringify(rows)).not.toContain('987651234')
  })

  it('Leitor e Responsável não usam a busca do check-in', async () => {
    await expect(t.as(f.users.readerA, `select * from public.search_checkin('raimundo')`)).rejects.toThrow(
      /check-in/,
    )
    await expect(t.as(f.users.leaderA1, `select * from public.search_checkin('raimundo')`)).rejects.toThrow(
      /check-in/,
    )
  })
})

describe('marcar presença', () => {
  it('registra e informa quem marcou', async () => {
    const r = await checkIn(f.users.reception, guestA)
    expect(r.status).toBe('registrada')
    expect(r.checked_in_by).toBe('Recepção')
  })

  it('segunda marcação devolve "já registrada" com hora e usuário (sem duplicar)', async () => {
    const r = await checkIn(f.users.managerA, guestA)
    expect(r.status).toBe('ja_registrada')
    expect(r.checked_in_by).toBe('Recepção')
    const rows = await t.admin(
      `select id from public.attendances where guest_id = $1 and revoked_at is null`,
      [guestA],
    )
    expect(rows).toHaveLength(1)
  })

  it('o índice único impede duas presenças ativas mesmo em inserção direta', async () => {
    await expect(
      t.admin(`insert into public.attendances (event_id, guest_id, type) values ($1, $2, 'presencial')`, [
        f.eventId,
        guestA,
      ]),
    ).rejects.toThrow(/duplicate key/)
  })

  it('corrida: 10 marcações simultâneas → exatamente 1 registrada', async () => {
    const g = await newGuest('Corrida Concorrente', '83988880001')
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => checkIn(i % 2 ? f.users.reception : f.users.admin, g)),
    )
    expect(results.filter((r) => r.status === 'registrada')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'ja_registrada')).toHaveLength(9)
    const rows = await t.admin(`select id from public.attendances where guest_id = $1`, [g])
    expect(rows).toHaveLength(1)
  })

  it('idempotente pelo client_request_id (reenvio da fila offline)', async () => {
    const g = await newGuest('Fila Offline', '83988880002')
    const req = '11111111-2222-3333-4444-555555555555'
    const first = await checkIn(f.users.reception, g, req)
    const again = await checkIn(f.users.reception, g, req)
    expect(first.status).toBe('registrada')
    expect(again.status).toBe('registrada')
    expect(again.repetida).toBe(true)
    expect(await t.admin(`select id from public.attendances where guest_id = $1`, [g])).toHaveLength(1)
  })

  it('Leitor e Responsável não marcam presença presencial', async () => {
    await expect(checkIn(f.users.readerA, guestB)).rejects.toThrow(/não pode marcar/)
    await expect(checkIn(f.users.leaderA1, guestB)).rejects.toThrow(/não pode marcar/)
  })
})

describe('desmarcar', () => {
  it('Recepção não desmarca', async () => {
    await expect(
      t.as(f.users.reception, `select public.revoke_attendance($1, 'presencial', 'engano')`, [guestA]),
    ).rejects.toThrow(/Somente o Gestor/)
  })

  it('Gestor de outra igreja não desmarca', async () => {
    await checkIn(f.users.reception, guestB)
    await expect(
      t.as(f.users.managerA, `select public.revoke_attendance($1, 'presencial', 'engano')`, [guestB]),
    ).rejects.toThrow(/Somente o Gestor/)
  })

  it('exige motivo', async () => {
    await expect(
      t.as(f.users.managerA, `select public.revoke_attendance($1, 'presencial', '')`, [guestA]),
    ).rejects.toThrow(/motivo/)
  })

  it('Gestor da igreja desmarca com motivo; a linha fica no histórico', async () => {
    await t.as(f.users.managerA, `select public.revoke_attendance($1, 'presencial', 'Marcado por engano')`, [
      guestA,
    ])
    const rows = await t.admin<{ revoked_at: string | null; revoke_reason: string }>(
      `select revoked_at, revoke_reason from public.attendances where guest_id = $1`,
      [guestA],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].revoke_reason).toBe('Marcado por engano')
    const hist = await t.as<{ revoked_by: string }>(
      f.users.managerA,
      `select * from public.attendance_history($1)`,
      [guestA],
    )
    expect(hist[0].revoked_by).toBe('Gestor A')
  })

  it('depois de desmarcar, pode marcar de novo (nova linha)', async () => {
    const r = await checkIn(f.users.reception, guestA)
    expect(r.status).toBe('registrada')
    expect(await t.admin(`select id from public.attendances where guest_id = $1`, [guestA])).toHaveLength(2)
  })

  it('marcar e desmarcar ficam na auditoria', async () => {
    const rows = await t.admin<{ action: string }>(
      `select action from public.audit_logs where table_name = 'attendances' order by id`,
    )
    const actions = rows.map((r) => r.action)
    expect(actions).toContain('attendances.marcar')
    expect(actions).toContain('attendances.desmarcar')
  })
})

describe('online', () => {
  it('Responsável registra participação online do convidado do seu grupo', async () => {
    const g = await newGuest('Assistiu Online', '83988880003')
    const r = await checkIn(f.users.leaderA1, g, null, 'online')
    expect(r.status).toBe('registrada')
  })

  it('online não ocupa a vaga do presencial (tipos independentes)', async () => {
    const r = await checkIn(f.users.managerA, guestA, null, 'online')
    expect(r.status).toBe('registrada')
    const rows = await t.admin(
      `select type from public.attendances where guest_id = $1 and revoked_at is null`,
      [guestA],
    )
    expect(rows).toHaveLength(2)
  })

  it('Gestor A não registra online de convidado da igreja B', async () => {
    await expect(checkIn(f.users.managerA, guestB, null, 'online')).rejects.toThrow(/permissão/)
  })
})

describe('cadastro na chegada (walk-in)', () => {
  it('com membro: cria convidado vinculado e marca presença', async () => {
    const [r] = await t.as<{ r: CheckResult }>(
      f.users.reception,
      `select public.walk_in_check_in(p_full_name => 'Chegou Agora', p_category => 'mulher', p_consent => true,
        p_phone => '83988880004', p_member_id => $1) as r`,
      [f.memberA1],
    )
    expect(r.r.status).toBe('registrada')
    const [g] = await t.admin<{ is_walk_in: boolean; member_id: string; church_id: string }>(
      `select is_walk_in, member_id, church_id from public.guests where id = $1`,
      [r.r.guest_id],
    )
    expect(g).toEqual({ is_walk_in: true, member_id: f.memberA1, church_id: f.churchA })
  })

  it('"Sem membro identificado": exige igreja e não entra nas metas individuais', async () => {
    await expect(
      t.as(
        f.users.reception,
        `select public.walk_in_check_in(p_full_name => 'Sem Membro', p_category => 'homem', p_consent => true, p_phone => '83988880005')`,
      ),
    ).rejects.toThrow(/escolha a igreja/)
    const [r] = await t.as<{ r: CheckResult }>(
      f.users.reception,
      `select public.walk_in_check_in(p_full_name => 'Sem Membro', p_category => 'homem', p_consent => true,
        p_phone => '83988880005', p_church_id => $1) as r`,
      [f.churchB],
    )
    const [g] = await t.admin<{ member_id: string | null; group_id: string | null }>(
      `select member_id, group_id from public.guests where id = $1`,
      [r.r.guest_id],
    )
    expect(g).toEqual({ member_id: null, group_id: null })
    const [s] = await t.as<{ guests_unique: number; present_unique: number }>(
      f.users.admin,
      `select guests_unique, present_unique from public.goal_summary($1, $2)`,
      [f.eventId, f.churchB],
    )
    expect(Number(s.present_unique)).toBe(2) // guestB + walk-in
  })

  it('criança na chegada exige responsável', async () => {
    await expect(
      t.as(
        f.users.reception,
        `select public.walk_in_check_in(p_full_name => 'Criança Sozinha', p_category => 'crianca', p_consent => true, p_church_id => $1)`,
        [f.churchA],
      ),
    ).rejects.toThrow(/responsável legal/)
  })

  it('reenvio do mesmo walk-in pela fila não cria convidado duplicado', async () => {
    const req = '99999999-8888-7777-6666-555555555555'
    const sql = `select public.walk_in_check_in(p_full_name => 'Walk Fila', p_category => 'homem', p_consent => true,
      p_phone => '83988880006', p_church_id => $1, p_client_request_id => $2) as r`
    await t.as(f.users.reception, sql, [f.churchA, req])
    await t.as(f.users.reception, sql, [f.churchA, req])
    expect(await t.admin(`select id from public.guests where full_name = 'Walk Fila'`)).toHaveLength(1)
  })

  it('Responsável de Grupo não faz walk-in', async () => {
    await expect(
      t.as(
        f.users.leaderA1,
        `select public.walk_in_check_in(p_full_name => 'X Y', p_category => 'homem', p_consent => true, p_phone => '83988880007', p_church_id => $1)`,
        [f.churchA],
      ),
    ).rejects.toThrow(/check-in/)
  })
})

describe('sinal de tempo real', () => {
  it('envia apenas um sinal sem dados pessoais', async () => {
    await t.admin(`delete from realtime.messages_stub`)
    await checkIn(f.users.reception, await newGuest('Sinal Teste', '83988880008'))
    const msgs = await t.admin<{ topic: string; event: string; payload: Record<string, unknown> }>(
      `select topic, event, payload from realtime.messages_stub`,
    )
    expect(msgs.length).toBeGreaterThan(0)
    expect(msgs.every((m) => m.topic === 'tef-sinal' && m.event === 'mudou')).toBe(true)
    const text = JSON.stringify(msgs)
    expect(text).not.toContain('Sinal Teste')
    expect(text).not.toContain('988880008')
  })
})
