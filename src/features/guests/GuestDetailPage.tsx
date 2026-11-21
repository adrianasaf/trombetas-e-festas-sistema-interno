import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FormError } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useScope } from '@/features/auth/scope'
import { useEvent } from '@/features/events/EventProvider'
import { MemberSearch, type MemberOption } from '@/features/members/MemberSearch'
import { translateError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { NotFoundPage } from '@/pages/StatusPages'
import { GuestDialog } from './GuestDialog'
import { invalidateGuestQueries, useGuest, type Guest } from './guestQueries'
import { CATEGORY_LABEL, MODE_LABEL, TRANSPORT_LABEL, inviteStatusLabel } from './labels'

interface GuestExtra {
  consents: {
    id: string
    consent_text: string
    given_by_guardian: boolean
    guardian_name: string | null
    consented_at: string
  }[]
  referrals: {
    id: string
    is_primary: boolean
    created_at: string
    member: { full_name: string } | null
    group: { name: string } | null
    church: { name: string } | null
  }[]
}

function useGuestExtra(id: string) {
  return useQuery({
    queryKey: ['guest-extra', id],
    queryFn: async (): Promise<GuestExtra> => {
      const [c, r] = await Promise.all([
        supabase
          .from('guest_consents')
          .select('id, consent_text, given_by_guardian, guardian_name, consented_at')
          .eq('guest_id', id)
          .order('consented_at'),
        supabase
          .from('guest_referrals')
          .select(
            'id, is_primary, created_at, member:members(full_name), group:assistance_groups(name), church:churches(name)',
          )
          .eq('guest_id', id)
          .order('created_at'),
      ])
      if (c.error) throw c.error
      if (r.error) throw r.error
      return { consents: c.data ?? [], referrals: (r.data ?? []) as unknown as GuestExtra['referrals'] }
    },
  })
}

/** Ficha do convidado. O bloco de presença (check-in) é fornecido pela Fase 6 via attendanceSlot. */
export function GuestDetailPage({ attendanceSlot }: { attendanceSlot?: (guest: Guest) => ReactNode }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const scope = useScope()
  const { readOnly } = useEvent()
  const guest = useGuest(id)
  const extra = useGuestExtra(id)
  const [editing, setEditing] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('guests').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Você não tem permissão para excluir este convidado.')
    },
    onSuccess: () => {
      toast.success('Convidado excluído.')
      invalidateGuestQueries(qc)
      navigate('/convidados', { replace: true })
    },
    onError: (e) => {
      const msg = translateError(e)
      toast.error(
        msg.includes('vinculado') ? 'Este convidado tem presença registrada e não pode ser excluído.' : msg,
      )
    },
  })

  if (guest.isLoading) return <Skeleton className="mx-auto h-64 max-w-4xl" />
  if (!guest.data) return <NotFoundPage />
  const g = guest.data
  const canReassign = scope.canManageChurch(g.church_id)
  const editable = !readOnly && !g.merged_into_id && !g.anonymized_at

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <nav className="text-sm text-muted-foreground">
        <Link to="/convidados" className="underline underline-offset-2">
          Convidados
        </Link>{' '}
        › {g.full_name}
      </nav>
      <PageHeader
        title={g.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {CATEGORY_LABEL[g.category]}
            {g.is_authority && <Badge variant="gold">Autoridade</Badge>}
            {g.is_other_church_pastor && <Badge variant="gold">Pastor de outra igreja</Badge>}
            {g.possible_duplicate && <Badge variant="warning">Possível duplicidade</Badge>}
            {g.is_walk_in && <Badge variant="secondary">Cadastrado na chegada</Badge>}
            {g.anonymized_at && <Badge variant="secondary">Anonimizado</Badge>}
          </span>
        }
        actions={
          editable && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                Editar
              </Button>
              {canReassign && (
                <Button variant="outline" onClick={() => setReassigning(true)}>
                  Reatribuir crédito
                </Button>
              )}
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  if (window.confirm(`Excluir ${g.full_name}? Esta ação não pode ser desfeita.`))
                    remove.mutate()
                }}
              >
                Excluir
              </Button>
            </>
          )
        }
      />

      {g.merged_into_id && (
        <p className="rounded-md bg-accent p-3 text-accent-foreground">
          Este registro foi mesclado.{' '}
          <Link to={`/convidados/${g.merged_into_id}`} className="font-semibold underline">
            Abrir o registro mantido
          </Link>
          .
        </p>
      )}

      {attendanceSlot ? (
        attendanceSlot(g)
      ) : (
        <Card className="border-2 border-gold">
          <CardContent className="pt-5 text-lg font-bold">[ ] COMPARECEU AO EVENTO?</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados do convite</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Info label="Telefone">{g.phone_normalized ? formatPhone(g.phone_normalized) : '—'}</Info>
            <Info label="Situação do convite">{inviteStatusLabel(g.invite_status, g.mode)}</Info>
            <Info label="Modalidade">{MODE_LABEL[g.mode]}</Info>
            <Info label="Transporte">
              {g.mode === 'online'
                ? 'Não se aplica (online)'
                : g.transport
                  ? TRANSPORT_LABEL[g.transport]
                  : '—'}
            </Info>
            {g.guardian_name && (
              <Info label="Responsável legal">
                {g.guardian_name} · {formatPhone(g.guardian_phone)}
              </Info>
            )}
            <Info label="Crédito do convite">
              {g.member?.full_name ?? 'Sem membro identificado'} · {g.group?.name ?? '—'} · {g.church?.name}
            </Info>
            <Info label="Cadastrado em">{formatDateTime(g.created_at)}</Info>
            {g.notes && <Info label="Observações">{g.notes}</Info>}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consentimento (LGPD)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {extra.data?.consents.map((c) => (
            <p key={c.id} className="rounded-md bg-muted p-3 text-sm">
              {c.consent_text}
              <span className="block text-muted-foreground">
                Registrado em {formatDateTime(c.consented_at)}
                {c.given_by_guardian && c.guardian_name ? ` · Responsável: ${c.guardian_name}` : ''}
              </span>
            </p>
          ))}
          {extra.data?.consents.length === 0 && (
            <p className="text-muted-foreground">Sem registro de consentimento.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membros que indicaram</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {extra.data?.referrals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">{r.member?.full_name ?? 'Sem membro identificado'}</span>
                <span className="text-muted-foreground">
                  {r.group?.name ?? '—'} · {r.church?.name} · {formatDateTime(r.created_at)}
                </span>
                {r.is_primary && <Badge variant="success">Recebe o crédito</Badge>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Quando dois membros cadastram a mesma pessoa, o crédito fica com o primeiro cadastro.
          </p>
        </CardContent>
      </Card>

      {editing && <GuestDialog guest={g} onClose={() => setEditing(false)} />}
      {reassigning && <ReassignDialog guest={g} onClose={() => setReassigning(false)} />}
    </div>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function ReassignDialog({ guest, onClose }: { guest: Guest; onClose: () => void }) {
  const qc = useQueryClient()
  const [member, setMember] = useState<MemberOption | null>(null)
  const [justification, setJustification] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reassign_guest_credit', {
        p_guest_id: guest.id,
        p_member_id: member!.id,
        p_justification: justification.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Crédito reatribuído. A alteração foi registrada na auditoria.')
      invalidateGuestQueries(qc)
      onClose()
    },
    onError: (e) => setError(translateError(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!member) return setError('Escolha o membro que deve receber o crédito.')
    if (justification.trim().length < 10)
      return setError('Escreva uma justificativa (mínimo de 10 caracteres).')
    setError(null)
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reatribuir crédito do convite</DialogTitle>
          <DialogDescription>
            Hoje o crédito está com {guest.member?.full_name ?? 'nenhum membro'}. A mudança fica registrada
            com a justificativa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field id="ra-member" label="Novo membro" required>
            <MemberSearch id="ra-member" value={member} onChange={setMember} onlyActive={false} />
          </Field>
          <Field id="ra-just" label="Justificativa" required>
            <textarea
              id="ra-just"
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Reatribuir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
