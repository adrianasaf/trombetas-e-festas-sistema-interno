import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvent } from '@/features/events/EventProvider'
import { invalidateGuestQueries } from '@/features/guests/guestQueries'
import { CATEGORY_LABEL, type GuestCategory } from '@/features/guests/labels'
import { translateError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'

type Status = 'pendente' | 'mesclado' | 'pessoas_diferentes'

interface Review {
  id: string
  status: Status
  reason: string
  similarity: number
  created_at: string
  resolution_note: string | null
  a_id: string
  a_name: string
  a_phone: string | null
  a_category: GuestCategory
  a_created_at: string
  a_member: string | null
  a_group: string | null
  a_church: string
  b_id: string
  b_name: string
  b_phone: string | null
  b_category: GuestCategory
  b_created_at: string
  b_member: string | null
  b_group: string | null
  b_church: string
}

const STATUS_LABEL: Record<Status, string> = {
  pendente: 'Pendentes',
  mesclado: 'Mescladas',
  pessoas_diferentes: 'Pessoas diferentes',
}

export function DuplicatesPage() {
  const qc = useQueryClient()
  const { current, readOnly } = useEvent()
  const [status, setStatus] = useState<Status>('pendente')
  const reviews = useQuery({
    queryKey: ['duplicates', current?.id, status],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_duplicate_reviews', {
        p_event_id: current!.id,
        p_status: status,
      })
      if (error) throw error
      return (data ?? []) as Review[]
    },
  })

  const onDone = (msg: string) => {
    toast.success(msg)
    void qc.invalidateQueries({ queryKey: ['duplicates'] })
    invalidateGuestQueries(qc)
  }
  const merge = useMutation({
    mutationFn: async ({ review, keep }: { review: Review; keep: string }) => {
      const { error } = await supabase.rpc('merge_guests', { p_review_id: review.id, p_keep_guest_id: keep })
      if (error) throw error
    },
    onSuccess: () => onDone('Registros mesclados. O crédito ficou com o primeiro cadastro.'),
    onError: (e) => toast.error(translateError(e)),
  })
  const distinct = useMutation({
    mutationFn: async (review: Review) => {
      const { error } = await supabase.rpc('resolve_duplicate_distinct', { p_review_id: review.id })
      if (error) throw error
    },
    onSuccess: () => onDone('Marcado como pessoas diferentes.'),
    onError: (e) => toast.error(translateError(e)),
  })
  const busy = merge.isPending || distinct.isPending

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Duplicidades"
        description="Telefone igual não bloqueia o cadastro: famílias podem dividir o número. Revise cada caso."
      />
      <div className="mb-4 max-w-xs">
        <NativeSelect
          aria-label="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {reviews.isLoading && <Skeleton className="h-40" />}
      {reviews.error && (
        <p role="alert" className="text-destructive">
          {translateError(reviews.error)}
        </p>
      )}
      {reviews.data?.length === 0 && (
        <EmptyState title={status === 'pendente' ? 'Nenhuma duplicidade para revisar' : 'Nada por aqui'}>
          {status === 'pendente' ? 'Quando um cadastro parecer repetido, ele aparece aqui.' : null}
        </EmptyState>
      )}
      <div className="space-y-4">
        {reviews.data?.map((r) => {
          const firstIsA = new Date(r.a_created_at) <= new Date(r.b_created_at)
          return (
            <Card key={r.id}>
              <CardContent className="space-y-4 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">{r.reason}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Nomes {Math.round(r.similarity * 100)}% parecidos · detectado em{' '}
                    {formatDateTime(r.created_at)}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    {
                      id: r.a_id,
                      name: r.a_name,
                      phone: r.a_phone,
                      cat: r.a_category,
                      at: r.a_created_at,
                      member: r.a_member,
                      group: r.a_group,
                      church: r.a_church,
                      first: firstIsA,
                    },
                    {
                      id: r.b_id,
                      name: r.b_name,
                      phone: r.b_phone,
                      cat: r.b_category,
                      at: r.b_created_at,
                      member: r.b_member,
                      group: r.b_group,
                      church: r.b_church,
                      first: !firstIsA,
                    },
                  ].map((g) => (
                    <div key={g.id} className="space-y-1 rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/convidados/${g.id}`}
                          className="font-semibold underline underline-offset-2"
                        >
                          {g.name}
                        </Link>
                        {g.first && <Badge variant="success">Primeiro cadastro (crédito)</Badge>}
                      </div>
                      <div className="text-sm">
                        {formatPhone(g.phone)} · {CATEGORY_LABEL[g.cat]}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Por {g.member ?? 'sem membro'} · {g.group ?? '—'} · {g.church}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Cadastrado em {formatDateTime(g.at)}
                      </div>
                      {status === 'pendente' && !readOnly && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Mesclar mantendo os dados de "${g.name}"? O crédito fica com o primeiro cadastro.`,
                              )
                            )
                              merge.mutate({ review: r, keep: g.id })
                          }}
                        >
                          Mesclar mantendo este
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {status === 'pendente' && !readOnly && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={busy}
                    onClick={() => distinct.mutate(r)}
                  >
                    São pessoas diferentes
                  </Button>
                )}
                {r.resolution_note && (
                  <p className="text-sm text-muted-foreground">Observação: {r.resolution_note}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
