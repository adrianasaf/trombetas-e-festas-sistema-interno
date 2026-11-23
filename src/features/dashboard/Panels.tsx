import { Link } from 'react-router-dom'
import { BarList, ChartCard, DataTable, LineChart, SplitBar } from '@/components/charts/charts'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvent } from '@/features/events/EventProvider'
import {
  useGoalByChurch,
  useGoalByGroup,
  useGoalSummary,
  useMemberGoals,
  type GoalStats,
} from '@/features/goals/goalQueries'
import { CATEGORY_LABEL } from '@/features/guests/labels'
import { formatPercent, numberFmt } from '@/lib/format'
import { StatCards } from './StatCards'
import {
  fillDays,
  pctLabel,
  shortDay,
  useCategories,
  useDaily,
  useTransportStats,
  type Scope3,
} from './statsQueries'

const TRANSPORT_LABEL = {
  pendente: 'Pendente',
  organizado: 'Transporte organizado',
  concluido: 'Concluído',
} as const

/** Gráficos comuns aos três níveis: evolução diária, categorias e presencial × online. */
export function CommonCharts({ scope, stats }: { scope: Scope3; stats: GoalStats | null | undefined }) {
  const daily = useDaily(scope)
  const cats = useCategories(scope)
  const days = fillDays(daily.data ?? [], (day) => ({ day, invites: 0, attendances: 0 }))
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="Evolução diária"
        description="Convites cadastrados e presenças registradas por dia (horário de Fortaleza)."
        table={
          <DataTable
            head={['Dia', 'Convites', 'Presenças']}
            rows={days.map((d) => [shortDay(d.day), d.invites, d.attendances])}
          />
        }
      >
        {daily.isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <LineChart
            series={['Convites', 'Presenças']}
            points={days.map((d) => ({ x: shortDay(d.day), values: [d.invites, d.attendances] }))}
          />
        )}
      </ChartCard>
      <ChartCard
        title="Presencial × online"
        description="Quem participou dos dois jeitos conta só como presencial. Online é autodeclarado."
      >
        {stats ? (
          <SplitBar
            parts={[
              { label: 'Presencial', value: stats.present_unique },
              { label: 'Somente online', value: stats.online_only },
            ]}
          />
        ) : (
          <Skeleton className="h-24" />
        )}
      </ChartCard>
      <ChartCard
        title="Categorias dos convidados"
        description="Convidados cadastrados por categoria."
        table={
          <DataTable
            head={['Categoria', 'Convidados', 'Presentes', 'Só online']}
            rows={(cats.data ?? []).map((c) => [CATEGORY_LABEL[c.category], c.guests, c.present, c.online])}
          />
        }
      >
        {cats.isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <BarList
            rows={(cats.data ?? [])
              .slice()
              .sort((a, b) => b.guests - a.guests)
              .map((c) => ({
                key: c.category,
                label: CATEGORY_LABEL[c.category],
                value: c.guests,
                detail: `${numberFmt.format(c.present)} presentes · ${numberFmt.format(c.online)} só online`,
              }))}
          />
        )}
      </ChartCard>
      <TransportCard scope={scope} />
    </div>
  )
}

function TransportCard({ scope }: { scope: Scope3 }) {
  const t = useTransportStats(scope)
  const get = (s: keyof typeof TRANSPORT_LABEL) => t.data?.find((r) => r.status === s)?.total ?? 0
  return (
    <ChartCard title="Situação do transporte" description="Convidados que precisam de transporte.">
      {t.isLoading ? (
        <Skeleton className="h-24" />
      ) : (
        <BarList
          emptyText="Nenhum convidado precisa de transporte."
          rows={(['pendente', 'organizado', 'concluido'] as const)
            .map((s) => ({ key: s, label: TRANSPORT_LABEL[s], value: get(s) }))
            .filter((r, _, all) => all.some((x) => x.value > 0) && r)}
        />
      )}
    </ChartCard>
  )
}

/** Dashboard geral do Polo (seção 13). */
export function PoloDashboard() {
  const { current } = useEvent()
  const eventId = current?.id
  const summary = useGoalSummary(eventId)
  const byChurch = useGoalByChurch(eventId)
  const byGroup = useGoalByGroup(eventId)
  const churches = byChurch.data ?? []
  const groups = byGroup.data ?? []
  const rankChurch = [...churches].sort((a, b) => (b.pct_invites ?? -1) - (a.pct_invites ?? -1))
  const rankGroups = [...groups]
    .filter((g) => g.members_goal_base > 0)
    .sort((a, b) => (b.pct_invites ?? -1) - (a.pct_invites ?? -1))

  return (
    <div className="space-y-5">
      <StatCards
        stats={summary.data}
        loading={summary.isLoading}
        churches={churches.length}
        groups={groups.filter((g) => g.group_active).length}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Convites por igreja"
          description="Convidados únicos em relação à meta de cada igreja. Toque para abrir o painel."
          table={
            <DataTable
              head={['Igreja', 'Convidados', 'Meta', '%']}
              rows={churches.map((c) => [
                c.church_name,
                c.guests_unique,
                c.invites_goal,
                c.pct_invites === null ? '—' : `${c.pct_invites}%`,
              ])}
            />
          }
        >
          {/* Barra = progresso até a meta da própria igreja (100% no filete dourado), não comparação entre igrejas. */}
          <BarList
            max={Math.max(100, ...churches.map((c) => c.pct_invites ?? 0))}
            goalAt={100}
            rows={[...churches]
              .sort((a, b) => b.guests_unique - a.guests_unique)
              .map((c) => ({
                key: c.church_id,
                label: c.church_name,
                value: c.pct_invites ?? 0,
                valueLabel: `${numberFmt.format(c.guests_unique)} / ${numberFmt.format(c.invites_goal)}${
                  c.invites_goal > 0 ? ` · ${formatPercent(c.pct_invites)}` : ''
                }`,
                href: `/igrejas/${c.church_id}`,
              }))}
          />
        </ChartCard>
        <ChartCard
          title="Presença presencial por igreja"
          table={
            <DataTable
              head={['Igreja', 'Presentes', 'Meta', '%']}
              rows={churches.map((c) => [
                c.church_name,
                c.present_unique,
                c.attendance_goal,
                c.pct_attendance === null ? '—' : `${c.pct_attendance}%`,
              ])}
            />
          }
        >
          <BarList
            max={Math.max(100, ...churches.map((c) => c.pct_attendance ?? 0))}
            goalAt={100}
            rows={[...churches]
              .sort((a, b) => b.present_unique - a.present_unique)
              .map((c) => ({
                key: c.church_id,
                label: c.church_name,
                value: c.pct_attendance ?? 0,
                valueLabel: `${numberFmt.format(c.present_unique)} / ${numberFmt.format(c.attendance_goal)}${
                  c.attendance_goal > 0 ? ` · ${formatPercent(c.pct_attendance)}` : ''
                }`,
                href: `/igrejas/${c.church_id}`,
              }))}
          />
        </ChartCard>
        <RankingCard
          title="Ranking das igrejas (% da meta de convites)"
          rows={rankChurch.map((c) => ({
            key: c.church_id,
            label: c.church_name,
            stats: c,
            href: `/igrejas/${c.church_id}`,
          }))}
        />
        <RankingCard
          title="Desempenho dos grupos (% da meta de convites)"
          rows={rankGroups.map((g) => ({
            key: g.group_id,
            label: `${g.group_name} · ${g.church_name}`,
            stats: g,
            href: `/grupos/${g.group_id}`,
          }))}
          limit={15}
        />
      </div>
      <CommonCharts scope={{ eventId }} stats={summary.data} />
    </div>
  )
}

function RankingCard({
  title,
  rows,
  limit,
}: {
  title: string
  rows: { key: string; label: string; stats: GoalStats; href: string }[]
  limit?: number
}) {
  const shown = limit ? rows.slice(0, limit) : rows
  return (
    <ChartCard
      title={title}
      description="Sempre com os números absolutos ao lado. Presença entre parênteses."
      table={
        <DataTable
          head={['#', 'Nome', 'Convites', 'Presença']}
          rows={rows.map((r, i) => [
            i + 1,
            r.label,
            pctLabel(r.stats.guests_unique, r.stats.invites_goal, r.stats.pct_invites),
            pctLabel(r.stats.present_unique, r.stats.attendance_goal, r.stats.pct_attendance),
          ])}
        />
      }
    >
      <BarList
        max={Math.max(100, ...shown.map((r) => r.stats.pct_invites ?? 0))}
        goalAt={100}
        rows={shown.map((r, i) => ({
          key: r.key,
          label: `${i + 1}º ${r.label}`,
          value: r.stats.pct_invites ?? 0,
          valueLabel: pctLabel(r.stats.guests_unique, r.stats.invites_goal, r.stats.pct_invites),
          detail: `Presença: ${pctLabel(r.stats.present_unique, r.stats.attendance_goal, r.stats.pct_attendance)}`,
          href: r.href,
        }))}
      />
      {limit && rows.length > limit && (
        <p className="mt-2 text-xs text-muted-foreground">
          Mostrando {limit} de {rows.length}. Veja todos em “Ver tabela”.
        </p>
      )}
    </ChartCard>
  )
}

/** Painel da igreja (seção 13). */
export function ChurchPanel({ churchId }: { churchId: string }) {
  const { current } = useEvent()
  const eventId = current?.id
  const summary = useGoalSummary(eventId, churchId)
  const groups = useGoalByGroup(eventId, churchId)
  return (
    <div className="space-y-5">
      <StatCards
        stats={summary.data}
        loading={summary.isLoading}
        groups={(groups.data ?? []).filter((g) => g.group_active).length}
      />
      <ChartCard
        title="Grupos da igreja"
        description="Toque em um grupo para ver o desempenho por membro."
        table={
          <DataTable
            head={['Grupo', 'Membros', 'Convites', 'Presença']}
            rows={(groups.data ?? []).map((g) => [
              g.group_name,
              g.members_goal_base,
              pctLabel(g.guests_unique, g.invites_goal, g.pct_invites),
              pctLabel(g.present_unique, g.attendance_goal, g.pct_attendance),
            ])}
          />
        }
      >
        {groups.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <BarList
            emptyText="Nenhum grupo cadastrado."
            max={Math.max(100, ...(groups.data ?? []).map((g) => g.pct_invites ?? 0))}
            goalAt={100}
            rows={(groups.data ?? []).map((g) => ({
              key: g.group_id,
              label: g.group_active ? g.group_name : `${g.group_name} (inativo)`,
              value: g.pct_invites ?? 0,
              valueLabel: pctLabel(g.guests_unique, g.invites_goal, g.pct_invites),
              detail: `Presença: ${pctLabel(g.present_unique, g.attendance_goal, g.pct_attendance)} · ${g.members_goal_base} membros`,
              href: `/grupos/${g.group_id}`,
            }))}
          />
        )}
      </ChartCard>
      <CommonCharts scope={{ eventId, churchId }} stats={summary.data} />
    </div>
  )
}

/** Painel do grupo (seção 13): desempenho por membro. */
export function GroupPanel({ groupId }: { groupId: string }) {
  const { current } = useEvent()
  const eventId = current?.id
  const summary = useGoalSummary(eventId, null, groupId)
  const members = useMemberGoals(eventId, { groupId })
  const rows = members.data ?? []
  const inGoal = rows.filter((m) => m.in_goal)
  const met = inGoal.filter((m) => m.met_invites && m.met_attendance)
  const improve = inGoal.filter((m) => !m.met_invites || !m.met_attendance)
  return (
    <div className="space-y-5">
      <StatCards stats={summary.data} loading={summary.isLoading} />
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-xl font-bold">Desempenho por membro</h3>
          <span className="text-sm text-muted-foreground">
            {met.length} cumpriram as duas metas · {improve.length} precisam melhorar
          </span>
        </div>
        {members.isLoading && <Skeleton className="h-32" />}
        {!members.isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sem membros com acesso liberado para você neste grupo.
          </p>
        )}
        {rows.length > 0 && (
          <div className="max-h-[32rem] overflow-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th scope="col">Membro</th>
                  <th scope="col">Convidados</th>
                  <th scope="col">Presentes</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const ok = m.met_invites && m.met_attendance
                  return (
                    <tr key={m.member_id}>
                      <td data-label="">
                        <Link
                          to={`/membros/${m.member_id}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {m.full_name}
                        </Link>
                        {!m.member_active && (
                          <span className="ml-1 text-xs text-muted-foreground">(inativo)</span>
                        )}
                      </td>
                      <td data-label="Convidados" className="num">
                        {m.invited}/{m.invites_goal}
                      </td>
                      <td data-label="Presentes" className="num">
                        {m.present}/{m.attendance_goal}
                      </td>
                      <td data-label="Situação">
                        {!m.in_goal ? (
                          <Badge variant="secondary">Fora da meta</Badge>
                        ) : ok ? (
                          <Badge variant="success">✓ Meta cumprida</Badge>
                        ) : m.met_invites ? (
                          <Badge variant="warning">Falta presença</Badge>
                        ) : (
                          <Badge variant="destructive">Abaixo da meta</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <CommonCharts scope={{ eventId, groupId }} stats={summary.data} />
    </div>
  )
}
