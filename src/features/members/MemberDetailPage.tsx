import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { translateError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { NotFoundPage } from '@/pages/StatusPages'
import { MemberDialog } from './MemberDialog'
import { TransferDialog } from './TransferDialog'
import { invalidateMemberQueries, useMember, useMemberHistory } from './memberQueries'

/** Ficha do membro. Metas e convidados entram nas fases 4 e 5 (MemberGuestsSection / MemberGoalCard). */
export function MemberDetailPage({
  goalSlot,
  guestsSlot,
}: {
  goalSlot?: (memberId: string) => React.ReactNode
  guestsSlot?: (memberId: string, active: boolean) => React.ReactNode
}) {
  const { id = '' } = useParams()
  const member = useMember(id)
  const history = useMemberHistory(id)
  const [editing, setEditing] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('members').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Você não tem permissão para excluir este membro.')
    },
    onSuccess: () => {
      toast.success('Membro excluído.')
      invalidateMemberQueries(qc)
      navigate('/membros', { replace: true })
    },
    onError: (e) => {
      const code = (e as { code?: string }).code
      toast.error(
        code === '23503'
          ? 'Este membro já tem convidados cadastrados e não pode ser excluído. Exclua ou reatribua os convidados antes, ou apenas inative o membro.'
          : translateError(e),
      )
    },
  })

  if (member.isLoading) return <Skeleton className="mx-auto h-48 max-w-4xl" />
  if (!member.data) return <NotFoundPage />
  const m = member.data

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <nav className="text-sm text-muted-foreground">
        <Link to="/membros" className="underline underline-offset-2">
          Membros
        </Link>{' '}
        › {m.full_name}
      </nav>
      <PageHeader
        title={m.full_name}
        description={
          <>
            <Link to={`/grupos/${m.group_id}`} className="underline underline-offset-2">
              {m.group?.name}
            </Link>{' '}
            · {m.church?.name} {!m.active && <Badge variant="destructive">Inativo</Badge>}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Editar
            </Button>
            {m.active && (
              <Button variant="outline" onClick={() => setTransferring(true)}>
                Transferir
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Excluir ${m.full_name}? Use apenas para corrigir um cadastro feito por engano. Esta ação não pode ser desfeita.`,
                  )
                )
                  remove.mutate()
              }}
            >
              Excluir
            </Button>
          </>
        }
      />

      {goalSlot?.(m.id)}

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Telefone</dt>
              <dd>{m.phone_normalized ? formatPhone(m.phone_normalized) : 'Não informado'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Data de entrada</dt>
              <dd>{formatDate(m.joined_at)}</dd>
            </div>
            {m.inactivated_at && (
              <div>
                <dt className="text-sm text-muted-foreground">Data de inativação</dt>
                <dd>{formatDate(m.inactivated_at)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {guestsSlot?.(m.id, m.active)}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de grupos</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading && <Skeleton className="h-12" />}
          <ol className="space-y-2">
            {history.data?.map((h) => (
              <li key={h.id} className="rounded-md bg-muted p-3 text-sm">
                <span className="font-semibold">{formatDateTime(h.changed_at)}</span> ·{' '}
                {h.from_group
                  ? `Transferido de ${h.from_group.name} (${h.from_church?.name}) para ${h.to_group?.name} (${h.to_church?.name})`
                  : `Cadastrado em ${h.to_group?.name} (${h.to_church?.name})`}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {editing && <MemberDialog member={m} onClose={() => setEditing(false)} />}
      {transferring && <TransferDialog member={m} onClose={() => setTransferring(false)} />}
    </div>
  )
}
