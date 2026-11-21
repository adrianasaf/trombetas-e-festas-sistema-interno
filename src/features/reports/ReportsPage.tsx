import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useScope } from '@/features/auth/scope'
import { pctLabel } from '@/features/dashboard/statsQueries'
import { useEvent } from '@/features/events/EventProvider'
import { useGoalByChurch, useGoalByGroup, useGoalSummary } from '@/features/goals/goalQueries'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  INVITE_STATUSES,
  INVITE_STATUS_LABEL,
  MODE_LABEL,
  TRANSPORTS,
  TRANSPORT_LABEL,
  inviteStatusLabel,
  type GuestCategory,
  type InviteStatus,
  type ParticipationMode,
  type TransportNeed,
} from '@/features/guests/labels'
import { useChurches, useGroups } from '@/features/shared/queries'
import { csvFilename, downloadCsv } from '@/lib/csv'
import { translateError } from '@/lib/errors'
import { formatDateTime, numberFmt, todayIso } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'

interface ReportRow {
  guest_id: string
  full_name: string
  phone: string | null
  category: GuestCategory
  is_authority: boolean
  is_other_church_pastor: boolean
  mode: ParticipationMode
  transport: TransportNeed | null
  invite_status: InviteStatus
  church_name: string
  group_name: string | null
  member_name: string | null
  is_walk_in: boolean
  guardian_name: string | null
  created_at: string
  presencial_at: string | null
  online_at: string | null
}

export function ReportsPage() {
  const { roles } = useAuth()
  const canList = roles.some((r) => r === 'polo_admin' || r === 'church_manager' || r === 'group_leader')
  const [tab, setTab] = useState<'final' | 'convidados'>(canList ? 'convidados' : 'final')
  const { current } = useEvent()

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Relatórios"
        description={current?.name}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir / PDF
          </Button>
        }
      />
      <div className="no-print mb-4 flex gap-2" role="tablist">
        {canList && (
          <Button
            role="tab"
            aria-selected={tab === 'convidados'}
            variant={tab === 'convidados' ? 'default' : 'outline'}
            onClick={() => setTab('convidados')}
          >
            Convidados
          </Button>
        )}
        <Button
          role="tab"
          aria-selected={tab === 'final'}
          variant={tab === 'final' ? 'default' : 'outline'}
          onClick={() => setTab('final')}
        >
          Relatório final do evento
        </Button>
      </div>
      <p className="no-print mb-4 text-sm text-muted-foreground">
        Para gerar PDF, use “Imprimir / PDF” e escolha “Salvar como PDF” no destino da impressão.
      </p>
      {tab === 'convidados' && canList ? <GuestReport /> : <FinalReport />}
    </div>
  )
}

function GuestReport() {
  const scope = useScope()
  const { current } = useEvent()
  const churches = useChurches()
  const [f, setF] = useState({
    churchId: '',
    groupId: '',
    category: '',
    special: '',
    inviteStatus: '',
    transport: '',
    presence: '',
    online: '',
  })
  const groups = useGroups(f.churchId || null)
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))
  const report = useQuery({
    queryKey: ['guests', 'report', current?.id, f],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_guests', {
        p_event_id: current!.id,
        p_church_id: f.churchId || null,
        p_group_id: f.groupId || null,
        p_category: f.category || null,
        p_special: f.special || null,
        p_invite_status: f.inviteStatus || null,
        p_transport: f.transport || null,
        p_presence: f.presence || null,
        p_online: f.online || null,
      })
      if (error) throw error
      return (data ?? []) as ReportRow[]
    },
  })
  const visibleChurches = (churches.data ?? []).filter(
    (c) => scope.isAdmin || scope.managedChurchIds.includes(c.id),
  )
  const withPhone = scope.isAdmin || (!!f.churchId && scope.managedChurchIds.includes(f.churchId))
  const rows = report.data ?? []

  async function exportCsv() {
    const { error } = await supabase.rpc('log_export', {
      p_kind: 'convidados',
      p_event_id: current!.id,
      p_church_id: f.churchId || null,
      p_rows: rows.length,
      p_with_phone: withPhone,
      p_filters: f,
    })
    if (error) return toast.error(translateError(error))
    downloadCsv(
      csvFilename('convidados', current?.name, todayIso()),
      [
        'Nome',
        ...(withPhone ? ['Telefone'] : []),
        'Categoria',
        'Autoridade',
        'Pastor de outra igreja',
        'Modalidade',
        'Transporte',
        'Situação do convite',
        'Igreja',
        'Grupo',
        'Membro que convidou',
        'Responsável legal',
        'Cadastro na chegada',
        'Cadastrado em',
        'Presença presencial',
        'Participação online',
      ],
      rows.map((r) => [
        r.full_name,
        ...(withPhone ? [formatPhone(r.phone)] : []),
        CATEGORY_LABEL[r.category],
        r.is_authority,
        r.is_other_church_pastor,
        MODE_LABEL[r.mode],
        r.transport ? TRANSPORT_LABEL[r.transport] : '',
        inviteStatusLabel(r.invite_status, r.mode),
        r.church_name,
        r.group_name ?? '',
        r.member_name ?? 'Sem membro identificado',
        r.guardian_name ?? '',
        r.is_walk_in,
        formatDateTime(r.created_at),
        formatDateTime(r.presencial_at),
        formatDateTime(r.online_at),
      ]),
    )
    toast.success(
      `Exportação registrada na auditoria (${rows.length} linhas${withPhone ? ', com telefone' : ', sem telefone'}).`,
    )
  }

  return (
    <div className="space-y-4">
      <div className="no-print grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibleChurches.length > 1 && (
          <NativeSelect
            aria-label="Igreja"
            value={f.churchId}
            onChange={(e) => set({ churchId: e.target.value, groupId: '' })}
          >
            <option value="">Polo (todas as igrejas)</option>
            {visibleChurches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect aria-label="Grupo" value={f.groupId} onChange={(e) => set({ groupId: e.target.value })}>
          <option value="">Todos os grupos</option>
          {(groups.data ?? [])
            .filter((g) => scope.canManageGroup(g))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Categoria"
          value={f.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Marcação especial"
          value={f.special}
          onChange={(e) => set({ special: e.target.value })}
        >
          <option value="">Qualquer marcação</option>
          <option value="autoridade">Autoridades</option>
          <option value="pastor">Pastores de outra igreja</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Situação do convite"
          value={f.inviteStatus}
          onChange={(e) => set({ inviteStatus: e.target.value })}
        >
          <option value="">Qualquer situação</option>
          {INVITE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INVITE_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Transporte"
          value={f.transport}
          onChange={(e) => set({ transport: e.target.value })}
        >
          <option value="">Qualquer transporte</option>
          {TRANSPORTS.map((t) => (
            <option key={t} value={t}>
              {TRANSPORT_LABEL[t]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Presença"
          value={f.presence}
          onChange={(e) => set({ presence: e.target.value })}
        >
          <option value="">Presença: todos</option>
          <option value="presente">Compareceram</option>
          <option value="ausente">Não compareceram</option>
        </NativeSelect>
        <NativeSelect aria-label="Online" value={f.online} onChange={(e) => set({ online: e.target.value })}>
          <option value="">Online: todos</option>
          <option value="online">Participaram online</option>
          <option value="nao_online">Sem participação online</option>
        </NativeSelect>
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {numberFmt.format(rows.length)} convidado(s) · exportação {withPhone ? 'com' : 'sem'} telefone
        </span>
        <Button variant="outline" disabled={!rows.length} onClick={() => void exportCsv()}>
          <Download /> Exportar CSV
        </Button>
      </div>
      {report.isLoading && <Skeleton className="h-48" />}
      {report.error && (
        <p role="alert" className="text-destructive">
          {translateError(report.error)}
        </p>
      )}
      {report.data?.length === 0 && <EmptyState title="Nenhum convidado com esses filtros" />}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Igreja / grupo</th>
                <th className="px-3 py-2">Membro</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Presença</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.guest_id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {r.full_name}
                    <span className="block text-xs text-muted-foreground">{CATEGORY_LABEL[r.category]}</span>
                  </td>
                  <td className="px-3 py-2">
                    {r.church_name}
                    {r.group_name ? ` / ${r.group_name}` : ''}
                  </td>
                  <td className="px-3 py-2">{r.member_name ?? '—'}</td>
                  <td className="px-3 py-2">{inviteStatusLabel(r.invite_status, r.mode)}</td>
                  <td className="px-3 py-2">
                    {r.presencial_at
                      ? `Presencial ${formatDateTime(r.presencial_at)}`
                      : r.online_at
                        ? 'Online (autodeclarado)'
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Relatório final do evento (seção 16): números agregados, por igreja e por grupo. */
function FinalReport() {
  const { current } = useEvent()
  const summary = useGoalSummary(current?.id)
  const byChurch = useGoalByChurch(current?.id)
  const byGroup = useGoalByGroup(current?.id)
  const s = summary.data
  const n = (v: number) => numberFmt.format(v)

  async function exportCsv() {
    const { error } = await supabase.rpc('log_export', {
      p_kind: 'relatorio_final',
      p_event_id: current!.id,
      p_church_id: null,
      p_rows: (byChurch.data?.length ?? 0) + (byGroup.data?.length ?? 0),
      p_with_phone: false,
      p_filters: {},
    })
    if (error) return toast.error(translateError(error))
    downloadCsv(
      csvFilename('relatorio-final', current?.name, todayIso()),
      [
        'Nível',
        'Nome',
        'Igreja',
        'Membros na meta',
        'Meta de convites',
        'Convidados únicos',
        '% convites',
        'Meta presencial',
        'Presenças',
        '% presença',
        'Online',
        'Transporte',
      ],
      [
        ...(byChurch.data ?? []).map((c) => [
          'Igreja',
          c.church_name,
          c.church_name,
          c.members_goal_base,
          c.invites_goal,
          c.guests_unique,
          c.pct_invites ?? '',
          c.attendance_goal,
          c.present_unique,
          c.pct_attendance ?? '',
          c.online_registered,
          c.need_transport,
        ]),
        ...(byGroup.data ?? []).map((g) => [
          'Grupo',
          g.group_name,
          g.church_name,
          g.members_goal_base,
          g.invites_goal,
          g.guests_unique,
          g.pct_invites ?? '',
          g.attendance_goal,
          g.present_unique,
          g.pct_attendance ?? '',
          g.online_registered,
          g.need_transport,
        ]),
      ],
    )
  }

  if (summary.isLoading) return <Skeleton className="h-64" />
  return (
    <div className="space-y-5">
      <div className="no-print flex justify-end">
        <Button variant="outline" onClick={() => void exportCsv()} disabled={!byChurch.data?.length}>
          <Download /> Exportar CSV
        </Button>
      </div>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-xl font-bold">
          Resumo {s ? '' : '(sem acesso ao nível do Polo — veja por igreja abaixo)'}
        </h2>
        {s && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Item label="Total de membros (meta)" value={n(s.members_goal_base)} />
            <Item label="Convidados únicos" value={n(s.guests_unique)} />
            <Item label="Presenças presenciais" value={n(s.present_unique)} />
            <Item label="Participações online (autodeclaradas)" value={n(s.online_registered)} />
            <Item label="Precisaram de transporte" value={n(s.need_transport)} />
            <Item label="Cadastros na chegada" value={n(s.walk_ins)} />
            <Item
              label="Alcance da meta de convites"
              value={pctLabel(s.guests_unique, s.invites_goal, s.pct_invites)}
            />
            <Item
              label="Alcance da meta presencial"
              value={pctLabel(s.present_unique, s.attendance_goal, s.pct_attendance)}
            />
            <Item label="Alcance total (presencial + só online)" value={n(s.reach_total)} />
          </dl>
        )}
      </section>
      <PerfTable
        title="Desempenho por igreja"
        rows={(byChurch.data ?? []).map((c) => ({ key: c.church_id, name: c.church_name, ...c }))}
      />
      <PerfTable
        title="Desempenho por grupo"
        rows={(byGroup.data ?? []).map((g) => ({
          key: g.group_id,
          name: `${g.group_name} — ${g.church_name}`,
          ...g,
        }))}
      />
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}

function PerfTable({
  title,
  rows,
}: {
  title: string
  rows: {
    key: string
    name: string
    members_goal_base: number
    guests_unique: number
    invites_goal: number
    pct_invites: number | null
    present_unique: number
    attendance_goal: number
    pct_attendance: number | null
    online_registered: number
  }[]
}) {
  return (
    <section className="break-inside-avoid rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">Nome</th>
                <th className="px-2 py-2">Membros</th>
                <th className="px-2 py-2">Convites</th>
                <th className="px-2 py-2">Presença</th>
                <th className="px-2 py-2">Online</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">{r.name}</td>
                  <td className="px-2 py-2 tabular-nums">{r.members_goal_base}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {pctLabel(r.guests_unique, r.invites_goal, r.pct_invites)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {pctLabel(r.present_unique, r.attendance_goal, r.pct_attendance)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{r.online_registered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
