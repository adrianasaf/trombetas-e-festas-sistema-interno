import { CheckCircle2, CircleDashed } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvent } from '@/features/events/EventProvider'
import { useMemberGoals } from './goalQueries'

/** Ficha do membro: meta de convites, meta de presença e indicador de meta cumprida (seção 7). */
export function MemberGoalCard({ memberId }: { memberId: string }) {
  const { current } = useEvent()
  const goals = useMemberGoals(current?.id, { memberId })
  const g = goals.data?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metas {current ? `— ${current.name}` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        {goals.isLoading && <Skeleton className="h-24" />}
        {!current && <p className="text-muted-foreground">Nenhuma edição do evento cadastrada.</p>}
        {g && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <GoalBox
                label="Convidados cadastrados"
                value={g.invited}
                goal={g.invites_goal}
                met={g.in_goal && g.met_invites}
              />
              <GoalBox
                label="Convidados presentes"
                value={g.present}
                goal={g.attendance_goal}
                met={g.in_goal && g.met_attendance}
              />
            </div>
            {g.online > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                + {g.online} participação(ões) online (autodeclarada, não soma à presença presencial).
              </p>
            )}
            {!g.in_goal && (
              <p className="mt-3 rounded-md bg-accent p-3 text-sm text-accent-foreground">
                Este membro não entra na meta desta edição (entrou depois da data de corte ou estava inativo
                nela). Os convites dele continuam contando para o grupo e a igreja.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function GoalBox({ label, value, goal, met }: { label: string; value: number; goal: number; met: boolean }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0
  return (
    <div className={`rounded-md border-2 p-4 ${met ? 'border-success bg-success/10' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {met ? (
          <span className="flex items-center gap-1 text-sm font-bold text-success">
            <CheckCircle2 className="size-5" aria-hidden /> Meta cumprida
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <CircleDashed className="size-5" aria-hidden /> {goal > 0 ? 'Em andamento' : 'Sem meta'}
          </span>
        )}
      </div>
      <div className="mt-1 text-3xl font-bold">
        {value}
        <span className="text-lg font-medium text-muted-foreground">/{goal}</span>
      </div>
      {goal > 0 && (
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div className={`h-full ${met ? 'bg-success' : 'bg-gold'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}
