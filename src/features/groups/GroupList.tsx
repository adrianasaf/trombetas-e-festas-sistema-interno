import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useScope } from '@/features/auth/scope'
import { translateError } from '@/lib/errors'
import { numberFmt } from '@/lib/format'
import { GroupDialog } from './GroupDialog'
import { useGroupOverview, type GroupOverview } from './groupQueries'

export function GroupList({ churchId, showChurch }: { churchId?: string | null; showChurch?: boolean }) {
  const scope = useScope()
  const groups = useGroupOverview(churchId)
  const [editing, setEditing] = useState<GroupOverview | null>(null)

  if (groups.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }
  if (groups.error) {
    return (
      <p role="alert" className="text-destructive">
        {translateError(groups.error)}
      </p>
    )
  }
  if (!groups.data?.length) {
    return (
      <EmptyState title="Nenhum grupo de assistência ainda">
        {churchId && scope.canManageChurch(churchId)
          ? 'Cadastre o primeiro grupo para começar a incluir membros.'
          : 'Os grupos aparecem aqui quando forem cadastrados.'}
      </EmptyState>
    )
  }

  return (
    <>
      <ul className="divide-y rounded-lg border bg-card">
        {groups.data.map((g) => (
          <li key={g.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/grupos/${g.id}`} className="font-semibold hover:underline">
                  {g.name}
                </Link>
                {!g.active && <Badge variant="destructive">Inativo</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                {showChurch && `${g.church_name} · `}
                Responsável: {g.leader_name || 'não informado'}
                {g.assistant_leader_name ? ` · Auxiliar: ${g.assistant_leader_name}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm">
                <strong>{numberFmt.format(g.members_active)}</strong> membros ativos
              </span>
              <Button asChild variant="outline" size="sm">
                <Link to={`/grupos/${g.id}`}>Abrir</Link>
              </Button>
              {scope.canManageChurch(g.church_id) && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>
                  Editar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing && <GroupDialog group={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
