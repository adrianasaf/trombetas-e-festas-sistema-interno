import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { GoalStats } from '@/features/goals/goalQueries'
import { formatPercent, numberFmt } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Barra fina de progresso até a meta; dourada quando a meta é atingida. */
export function GoalBar({ value, goal, label }: { value: number; goal: number; label: string }) {
  if (goal <= 0) return null
  const pct = Math.min(100, Math.round((value / goal) * 100))
  const met = value >= goal
  return (
    <div
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full', met ? 'bg-gold' : 'bg-sky')} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  goal,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  goal?: { value: number; goal: number }
}) {
  const met = goal && goal.goal > 0 && goal.value >= goal.goal
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <span className="eyebrow">{label}</span>
      <div className="num mt-2 text-[2.5rem] leading-none font-semibold tracking-tight">{value}</div>
      {hint && <div className="num mt-2 text-sm text-muted-foreground">{hint}</div>}
      {met && (
        <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-accent-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-gold-shadow" strokeWidth={1.8} aria-hidden /> Meta
          atingida
        </div>
      )}
      {goal && <GoalBar value={goal.value} goal={goal.goal} label={label} />}
    </div>
  )
}

/** Indicadores da seção 13: quatro principais em destaque e os demais numa faixa compacta. */
export function StatCards({
  stats,
  loading,
  churches,
  groups,
}: {
  stats: GoalStats | null | undefined
  loading?: boolean
  churches?: number
  groups?: number
}) {
  if (loading)
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    )
  if (!stats) return <p className="text-muted-foreground">Ainda não há números para mostrar aqui.</p>
  const n = (v: number) => numberFmt.format(v)
  const secondary: [string, string][] = [
    ...(churches !== undefined ? ([['Igrejas', n(churches)]] as [string, string][]) : []),
    ...(groups !== undefined ? ([['Grupos', n(groups)]] as [string, string][]) : []),
    ['Membros na meta', n(stats.members_goal_base)],
    ['Confirmaram presença', n(stats.confirmed)],
    ['Cumpriram a meta de convites', `${n(stats.members_met_invites)} de ${n(stats.members_goal_base)}`],
    ['Cumpriram a meta de presença', `${n(stats.members_met_attendance)} de ${n(stats.members_goal_base)}`],
    ['Cadastrados na chegada', n(stats.walk_ins)],
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Convites"
          value={formatPercent(stats.pct_invites)}
          hint={`${n(stats.guests_unique)} convidados · meta ${n(stats.invites_goal)}`}
          goal={{ value: stats.guests_unique, goal: stats.invites_goal }}
        />
        <StatTile
          label="Presença presencial"
          value={formatPercent(stats.pct_attendance)}
          hint={`${n(stats.present_unique)} presentes · meta ${n(stats.attendance_goal)}`}
          goal={{ value: stats.present_unique, goal: stats.attendance_goal }}
        />
        <StatTile
          label="Participação online"
          value={n(stats.online_registered)}
          hint={`${n(stats.online_confirmed)} confirmaram · autodeclarada`}
        />
        <StatTile
          label="Precisam de transporte"
          value={n(stats.need_transport)}
          hint="Convidados presenciais"
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-card px-5 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {secondary.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="num text-lg font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
