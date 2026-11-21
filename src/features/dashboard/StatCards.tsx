import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { GoalStats } from '@/features/goals/goalQueries'
import { formatPercent, numberFmt } from '@/lib/format'
import { cn } from '@/lib/utils'

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'gold' | 'navy'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm',
        tone === 'gold' && 'border-gold/60 bg-accent/40',
        tone === 'navy' && 'border-navy bg-navy text-white',
      )}
    >
      <div className={cn('text-sm', tone === 'navy' ? 'text-white/80' : 'text-muted-foreground')}>
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums leading-tight">{value}</div>
      {hint && (
        <div className={cn('mt-1 text-xs', tone === 'navy' ? 'text-white/75' : 'text-muted-foreground')}>
          {hint}
        </div>
      )}
    </div>
  )
}

/** Cartões da seção 13. churches/groups são opcionais (só no Polo/igreja). */
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  if (!stats)
    return (
      <p className="text-muted-foreground">Sem dados para esta edição ou sem permissão para este nível.</p>
    )
  const n = (v: number) => numberFmt.format(v)
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {churches !== undefined && <StatTile label="Igrejas" value={n(churches)} />}
      {groups !== undefined && <StatTile label="Grupos de assistência" value={n(groups)} />}
      <StatTile
        label="Membros na meta"
        value={n(stats.members_goal_base)}
        hint="Membros ativos (ou do snapshot após a data de corte)"
      />
      <StatTile
        tone="navy"
        label="Convites"
        value={formatPercent(stats.pct_invites)}
        hint={`${n(stats.guests_unique)} convidados de uma meta de ${n(stats.invites_goal)}`}
      />
      <StatTile
        tone="navy"
        label="Presença presencial"
        value={formatPercent(stats.pct_attendance)}
        hint={`${n(stats.present_unique)} presentes de uma meta de ${n(stats.attendance_goal)}`}
      />
      <StatTile
        label="Convidados cadastrados"
        value={n(stats.guests_unique)}
        hint={`Meta: ${n(stats.invites_goal)}`}
      />
      <StatTile
        label="Presenças presenciais"
        value={n(stats.present_unique)}
        hint={`Meta: ${n(stats.attendance_goal)}`}
      />
      <StatTile label="Confirmaram presença" value={n(stats.confirmed)} />
      <StatTile
        label="Participações online"
        value={n(stats.online_registered)}
        hint={`${n(stats.online_confirmed)} confirmadas · autodeclaradas`}
      />
      <StatTile tone="gold" label="Precisam de transporte" value={n(stats.need_transport)} />
      <StatTile
        label="Membros com ≥ meta de convites"
        value={n(stats.members_met_invites)}
        hint={`${n(stats.members_below_invites)} abaixo da meta`}
      />
      <StatTile
        label="Membros com ≥ meta de presença"
        value={n(stats.members_met_attendance)}
        hint={`${n(stats.members_below_attendance)} abaixo da meta`}
      />
    </div>
  )
}
