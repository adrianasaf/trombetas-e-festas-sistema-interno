import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { EventRow } from '@/features/events/EventProvider'
import { translateError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'

/** Configurações › LGPD: anonimização por retenção e pedidos do titular (seção 14). */
export function PrivacyCard({ event }: { event: EventRow }) {
  return (
    <>
      <RetentionCard event={event} />
      <TitularCard />
    </>
  )
}

function RetentionCard({ event }: { event: EventRow }) {
  const qc = useQueryClient()
  const settings = useQuery({
    queryKey: ['event-settings', event.id, 'lgpd'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_settings')
        .select('retention_days, anonymized_at')
        .eq('event_id', event.id)
        .maybeSingle()
      if (error) throw error
      return data as { retention_days: number; anonymized_at: string | null } | null
    },
  })
  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('anonymize_event', { p_event_id: event.id })
      if (error) throw error
      return data as number
    },
    onSuccess: (n) => {
      toast.success(`${n} convidado(s) anonimizado(s). As estatísticas foram preservadas.`)
      void qc.invalidateQueries()
    },
    onError: (e) => toast.error(translateError(e)),
  })
  const s = settings.data
  const dueAt =
    event.closed_at && s
      ? new Date(new Date(event.closed_at).getTime() + s.retention_days * 86_400_000)
      : null
  const due = dueAt ? dueAt <= new Date() : false

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anonimização por retenção (LGPD)</CardTitle>
        <CardDescription>
          Substitui nomes e telefones de todos os convidados da edição, preservando as estatísticas.
          Irreversível.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {s?.anonymized_at ? (
          <p className="font-medium text-success">Edição anonimizada em {formatDateTime(s.anonymized_at)}.</p>
        ) : event.status !== 'encerrado' ? (
          <p className="text-muted-foreground">Disponível depois que a edição for encerrada.</p>
        ) : (
          <>
            <p>
              Prazo de {s?.retention_days ?? '…'} dias após o encerramento
              {dueAt ? `: liberado a partir de ${formatDate(dueAt.toISOString())}.` : '.'}
            </p>
            <Button
              variant="destructive"
              disabled={!due || run.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Anonimizar TODOS os convidados de "${event.name}"? Isto não pode ser desfeito.`,
                  )
                )
                  run.mutate()
              }}
            >
              {run.isPending ? 'Anonimizando…' : 'Anonimizar convidados desta edição'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface TitularRow {
  guest_id: string
  full_name: string
  phone: string | null
  guardian_name: string | null
  event_name: string
  church_name: string
  created_at: string
  anonymized_at: string | null
}

function TitularCard() {
  const qc = useQueryClient()
  const [term, setTerm] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [justification, setJustification] = useState('')
  const results = useQuery({
    queryKey: ['titular', submitted],
    enabled: submitted.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('find_titular', { p_query: submitted })
      if (error) throw error
      return (data ?? []) as TitularRow[]
    },
  })
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'anonimizar' | 'excluir' }) => {
      const { error } = await supabase.rpc('titular_request', {
        p_guest_id: id,
        p_action: action,
        p_justification: justification.trim(),
      })
      if (error) throw error
    },
    onSuccess: (_, v) => {
      toast.success(v.action === 'excluir' ? 'Dados excluídos.' : 'Dados anonimizados.')
      void qc.invalidateQueries({ queryKey: ['titular'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (e) => toast.error(translateError(e)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedido do titular</CardTitle>
        <CardDescription>
          Localize os dados de uma pessoa em todas as edições e atenda ao pedido de anonimização (mantém as
          estatísticas) ou de exclusão (remove o registro e as presenças). Cada atendimento fica na auditoria,
          sem guardar nome ou telefone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(term.trim())
          }}
        >
          <Input
            aria-label="Nome ou telefone do titular"
            placeholder="Nome (3+ letras) ou telefone completo"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Localizar
          </Button>
        </form>
        {results.data && (
          <>
            <Field
              id="tit-just"
              label="Descrição do pedido (obrigatória)"
              hint="Ex.: pedido por telefone em 21/11, recebido por Fulano."
            >
              <Input
                id="tit-just"
                value={justification}
                maxLength={500}
                onChange={(e) => setJustification(e.target.value)}
              />
            </Field>
            {results.data.length === 0 && (
              <p className="text-muted-foreground">Nenhum registro encontrado.</p>
            )}
            <ul className="space-y-2">
              {results.data.map((r) => (
                <li key={r.guest_id} className="rounded-md border p-3 text-sm">
                  <div className="font-semibold">{r.full_name}</div>
                  <div className="text-muted-foreground">
                    {formatPhone(r.phone)} · {r.event_name} · {r.church_name} · cadastrado em{' '}
                    {formatDateTime(r.created_at)}
                    {r.anonymized_at ? ' · já anonimizado' : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!r.anonymized_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={act.isPending || justification.trim().length < 10}
                        onClick={() =>
                          window.confirm(`Anonimizar os dados de ${r.full_name}? Não pode ser desfeito.`) &&
                          act.mutate({ id: r.guest_id, action: 'anonimizar' })
                        }
                      >
                        Anonimizar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={act.isPending || justification.trim().length < 10}
                      onClick={() =>
                        window.confirm(
                          `EXCLUIR definitivamente ${r.full_name}, inclusive presenças? Os totais do evento diminuirão. Não pode ser desfeito.`,
                        ) && act.mutate({ id: r.guest_id, action: 'excluir' })
                      }
                    >
                      Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
