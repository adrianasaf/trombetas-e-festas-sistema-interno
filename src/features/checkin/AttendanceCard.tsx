import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FormError } from '@/components/ui/field'
import { useAuth } from '@/features/auth/AuthProvider'
import { useScope } from '@/features/auth/scope'
import { useEvent } from '@/features/events/EventProvider'
import { invalidateGuestQueries, type Guest } from '@/features/guests/guestQueries'
import { translateError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { newRequestId, rpcCheckIn } from './checkinApi'

interface HistoryRow {
  id: string
  type: 'presencial' | 'online'
  checked_in_at: string
  checked_in_by: string | null
  revoked_at: string | null
  revoked_by: string | null
  revoke_reason: string | null
}

/** Destaque "[ ] COMPARECEU AO EVENTO?" da ficha do convidado (seção 11). */
export function AttendanceCard({ guest }: { guest: Guest }) {
  const qc = useQueryClient()
  const { roles } = useAuth()
  const scope = useScope()
  const { active, readOnly } = useEvent()
  const [revoking, setRevoking] = useState<'presencial' | 'online' | null>(null)
  const history = useQuery({
    queryKey: ['guest-extra', guest.id, 'attendance'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('attendance_history', { p_guest_id: guest.id })
      if (error) throw error
      return (data ?? []) as HistoryRow[]
    },
  })
  const activeOf = (t: 'presencial' | 'online') => history.data?.find((h) => h.type === t && !h.revoked_at)
  const presencial = activeOf('presencial')
  const online = activeOf('online')
  const canCheckIn =
    (roles.includes('polo_admin') || roles.includes('reception') || roles.includes('church_manager')) &&
    active?.id === guest.event_id
  const canRevoke = scope.canManageChurch(guest.church_id) && !readOnly
  const editable = !readOnly && !guest.merged_into_id

  const mark = useMutation({
    mutationFn: (type: 'presencial' | 'online') => rpcCheckIn(guest.id, newRequestId(), type),
    onSuccess: (r) => {
      toast[r.status === 'registrada' ? 'success' : 'info'](
        r.status === 'registrada'
          ? 'Registrado.'
          : `Já estava registrado às ${formatDateTime(r.checked_in_at)}.`,
      )
      invalidateGuestQueries(qc)
    },
    onError: (e) => toast.error(translateError(e)),
  })

  return (
    <Card className={cn('border-2', presencial ? 'border-success bg-success/5' : 'border-gold')}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xl font-bold">
            <span aria-hidden>{presencial ? '[✓]' : '[ ]'}</span> COMPARECEU AO EVENTO?
            <span className="sr-only">{presencial ? 'Sim' : 'Não'}</span>
          </div>
          {editable && !presencial && canCheckIn && (
            <Button
              size="lg"
              className="bg-success text-white hover:bg-success/90"
              disabled={mark.isPending}
              onClick={() => mark.mutate('presencial')}
            >
              COMPARECEU AO EVENTO ✓
            </Button>
          )}
        </div>
        {presencial ? (
          <p className="font-medium text-success">
            Presença registrada em {formatDateTime(presencial.checked_in_at)}
            {presencial.checked_in_by ? ` por ${presencial.checked_in_by}` : ''}.
          </p>
        ) : (
          <p className="text-muted-foreground">Presença presencial ainda não registrada.</p>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
          <span className="font-semibold">Participação online (autodeclarada):</span>
          {online ? (
            <span>
              registrada em {formatDateTime(online.checked_in_at)}
              {online.checked_in_by ? ` por ${online.checked_in_by}` : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">não registrada</span>
          )}
          {editable && !online && (
            <Button
              size="sm"
              variant="outline"
              disabled={mark.isPending}
              onClick={() => mark.mutate('online')}
            >
              Registrar participação online
            </Button>
          )}
        </div>
        {editable && canRevoke && (presencial || online) && (
          <div className="flex flex-wrap gap-2">
            {presencial && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setRevoking('presencial')}
              >
                Desmarcar presença
              </Button>
            )}
            {online && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setRevoking('online')}
              >
                Desmarcar online
              </Button>
            )}
          </div>
        )}
        {!!history.data?.some((h) => h.revoked_at) && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Histórico de presença</summary>
            <ul className="mt-2 space-y-1">
              {history.data.map((h) => (
                <li key={h.id} className="rounded bg-muted p-2">
                  {h.type === 'presencial' ? 'Presencial' : 'Online'}: marcado em{' '}
                  {formatDateTime(h.checked_in_at)}
                  {h.checked_in_by ? ` por ${h.checked_in_by}` : ''}
                  {h.revoked_at &&
                    ` · desmarcado em ${formatDateTime(h.revoked_at)}${h.revoked_by ? ` por ${h.revoked_by}` : ''} — motivo: ${h.revoke_reason}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
      {revoking && <RevokeDialog guest={guest} type={revoking} onClose={() => setRevoking(null)} />}
    </Card>
  )
}

function RevokeDialog({
  guest,
  type,
  onClose,
}: {
  guest: Guest
  type: 'presencial' | 'online'
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revoke_attendance', {
        p_guest_id: guest.id,
        p_type: type,
        p_reason: reason.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Desmarcado. O registro anterior fica no histórico.')
      invalidateGuestQueries(qc)
      onClose()
    },
    onError: (e) => setError(translateError(e)),
  })
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 3) return setError('Informe o motivo.')
    setError(null)
    revoke.mutate()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desmarcar {type === 'presencial' ? 'presença' : 'participação online'}</DialogTitle>
          <DialogDescription>{guest.full_name}. O motivo fica registrado na auditoria.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field id="rv-reason" label="Motivo" required>
            <textarea
              id="rv-reason"
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-base"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={revoke.isPending}>
              {revoke.isPending ? 'Desmarcando…' : 'Desmarcar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
