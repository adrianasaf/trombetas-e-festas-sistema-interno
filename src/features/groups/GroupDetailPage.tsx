import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useScope } from '@/features/auth/scope'
import { MemberDialog } from '@/features/members/MemberDialog'
import { useMembers } from '@/features/members/memberQueries'
import { NotFoundPage } from '@/pages/StatusPages'
import { GroupDialog } from './GroupDialog'
import { useGroupOverview } from './groupQueries'

/** Detalhes do grupo. O painel de desempenho por membro é acrescentado na Fase 7 (performanceSlot). */
export function GroupDetailPage({
  performanceSlot,
}: {
  performanceSlot?: (groupId: string) => React.ReactNode
}) {
  const { id = '' } = useParams()
  const scope = useScope()
  const navigate = useNavigate()
  const groups = useGroupOverview(null)
  const group = groups.data?.find((g) => g.id === id)
  const canManage = group ? scope.canManageGroup(group) : false
  const members = useMembers({ groupId: id, status: 'todos' })
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  if (groups.isLoading) return <Skeleton className="mx-auto h-40 max-w-5xl" />
  if (!group) return <NotFoundPage />

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav className="text-sm text-muted-foreground">
        {scope.isAdmin || scope.managedChurchIds.includes(group.church_id) ? (
          <Link to={`/igrejas/${group.church_id}`} className="underline underline-offset-2">
            {group.church_name}
          </Link>
        ) : (
          group.church_name
        )}{' '}
        › {group.name}
      </nav>
      <PageHeader
        title={group.name}
        description={
          <>
            Responsável: {group.leader_name || 'não informado'}
            {group.assistant_leader_name ? ` · Auxiliar: ${group.assistant_leader_name}` : ''} ·{' '}
            {group.members_active} membros ativos{' '}
            {!group.active && <Badge variant="destructive">Inativo</Badge>}
          </>
        }
        actions={
          <>
            {scope.canManageChurch(group.church_id) && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Editar grupo
              </Button>
            )}
            {canManage && group.active && (
              <Button size="lg" onClick={() => setAdding(true)}>
                Novo membro
              </Button>
            )}
          </>
        }
      />

      {performanceSlot?.(group.id)}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Membros</h2>
        {members.isLoading && <Skeleton className="h-24" />}
        {members.data?.length === 0 && (
          <EmptyState title="Nenhum membro neste grupo ainda">
            {canManage ? 'Cadastre o primeiro membro usando o botão acima.' : null}
          </EmptyState>
        )}
        {!!members.data?.length && (
          <ul className="divide-y rounded-lg border bg-card">
            {members.data.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/membros/${m.id}`}
                  className="flex min-h-12 items-center justify-between gap-2 px-4 hover:bg-secondary"
                >
                  <span className="font-medium">{m.full_name}</span>
                  {!m.active && <Badge variant="destructive">Inativo</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <GroupDialog group={group} onClose={() => setEditing(false)} />}
      {adding && (
        <MemberDialog
          member={null}
          defaultGroupId={group.id}
          onClose={() => setAdding(false)}
          onCreated={(mid) => navigate(`/membros/${mid}`)}
        />
      )}
    </div>
  )
}
