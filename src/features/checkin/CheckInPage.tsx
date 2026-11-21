import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Search, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvent } from '@/features/events/EventProvider'
import { CATEGORY_LABEL } from '@/features/guests/labels'
import { translateError } from '@/lib/errors'
import { formatTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  checkinQueue,
  newRequestId,
  playSuccessSound,
  rpcCheckIn,
  searchCheckin,
  type CheckinRow,
} from './checkinApi'
import { isNetworkError } from './offlineQueue'
import { PendingBanner } from './PendingBanner'
import { WalkInDialog } from './WalkInDialog'

type LocalState =
  | { kind: 'sending' }
  | { kind: 'ok'; at: string; by: string | null }
  | { kind: 'already'; at: string; by: string | null }
  | { kind: 'queued' }
  | { kind: 'error'; message: string }

function useCheckinSound(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-settings', eventId, 'sound'],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from('event_settings')
        .select('checkin_sound_enabled')
        .eq('event_id', eventId!)
        .maybeSingle()
      return data?.checkin_sound_enabled ?? true
    },
    staleTime: 5 * 60_000,
  }).data
}

export function CheckInPage() {
  const qc = useQueryClient()
  const { active } = useEvent()
  const sound = useCheckinSound(active?.id)
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [local, setLocal] = useState<Record<string, LocalState>>({})
  const [walkIn, setWalkIn] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  const digits = debounced.replace(/\D/g, '')
  const searchable = digits.length >= 4 || debounced.replace(/\d/g, '').trim().length >= 2
  const results = useQuery({
    queryKey: ['checkin-search', debounced],
    enabled: !!active && searchable,
    queryFn: () => searchCheckin(debounced),
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  })

  async function markPresent(row: CheckinRow) {
    const requestId = newRequestId()
    setLocal((s) => ({ ...s, [row.guest_id]: { kind: 'sending' } }))
    try {
      const r = await rpcCheckIn(row.guest_id, requestId)
      if (r.status === 'registrada') {
        if (sound !== false) playSuccessSound()
        if (navigator.vibrate) navigator.vibrate(80)
        setLocal((s) => ({ ...s, [row.guest_id]: { kind: 'ok', at: r.checked_in_at, by: r.checked_in_by } }))
      } else {
        setLocal((s) => ({
          ...s,
          [row.guest_id]: { kind: 'already', at: r.checked_in_at, by: r.checked_in_by },
        }))
      }
      void qc.invalidateQueries({ queryKey: ['stats'] })
    } catch (e) {
      if (isNetworkError(e)) {
        await checkinQueue.enqueue({
          id: requestId,
          kind: 'check_in',
          label: row.full_name,
          payload: { guestId: row.guest_id },
        })
        setLocal((s) => ({ ...s, [row.guest_id]: { kind: 'queued' } }))
      } else {
        setLocal((s) => ({ ...s, [row.guest_id]: { kind: 'error', message: translateError(e) } }))
      }
    }
  }

  if (!active) {
    return (
      <EmptyState title="Nenhuma edição ativa">
        O check-in fica disponível quando o Administrador ativar o evento em Configurações.
      </EmptyState>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Check-in</h1>
        <p className="text-muted-foreground">{active.name}</p>
      </div>
      <PendingBanner />
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          autoFocus
          type="search"
          inputMode="search"
          autoComplete="off"
          aria-label="Buscar convidado por nome ou telefone"
          placeholder="Nome ou telefone do convidado"
          className="min-h-16 pl-14 text-xl"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      {!searchable && (
        <p className="text-center text-muted-foreground">
          Digite pelo menos 2 letras do nome ou 4 dígitos do telefone.
        </p>
      )}
      {searchable && results.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      )}
      {results.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-destructive">
          {translateError(results.error)}
        </p>
      )}
      {searchable && results.data && (
        <ul className="space-y-3" aria-live="polite">
          {results.data.map((row) => (
            <ResultCard
              key={row.guest_id}
              row={row}
              state={local[row.guest_id]}
              onMark={() => void markPresent(row)}
            />
          ))}
        </ul>
      )}
      {searchable && results.data?.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card p-6 text-center">
          <p className="text-lg font-semibold">Convidado não encontrado</p>
          <p className="mb-4 text-muted-foreground">Confira a grafia ou busque pelo telefone.</p>
          <Button size="xl" variant="gold" className="w-full" onClick={() => setWalkIn(true)}>
            <UserPlus /> Cadastrar e marcar presença
          </Button>
        </div>
      )}
      {searchable && !!results.data?.length && (
        <Button variant="outline" className="w-full" onClick={() => setWalkIn(true)}>
          <UserPlus /> Não está na lista? Cadastrar e marcar presença
        </Button>
      )}
      {walkIn && (
        <WalkInDialog
          initialName={/\d/.test(debounced) ? '' : debounced}
          initialPhone={/\d{4,}/.test(digits) ? debounced : ''}
          onClose={() => {
            setWalkIn(false)
            inputRef.current?.focus()
          }}
          onDone={(ok) => {
            if (ok && sound !== false) playSuccessSound()
            setTerm('')
            void qc.invalidateQueries({ queryKey: ['checkin-search'] })
          }}
        />
      )}
    </div>
  )
}

function ResultCard({ row, state, onMark }: { row: CheckinRow; state?: LocalState; onMark: () => void }) {
  const already = state?.kind === 'already' || (!state && !!row.presencial_at)
  const done = state?.kind === 'ok' || already
  const at = state && (state.kind === 'ok' || state.kind === 'already') ? state.at : row.presencial_at
  const by = state && (state.kind === 'ok' || state.kind === 'already') ? state.by : row.presencial_by

  return (
    <li
      className={cn(
        'rounded-lg border-2 bg-card p-4 shadow-sm',
        done && 'border-success bg-success/5',
        state?.kind === 'queued' && 'border-warning',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight">{row.full_name}</div>
          <div className="text-muted-foreground">
            {row.church_name}
            {row.group_name ? ` · ${row.group_name}` : ''}
          </div>
          <div className="text-sm text-muted-foreground">
            Convidado por {row.member_name ?? 'sem membro identificado'} · {CATEGORY_LABEL[row.category]}
            {row.phone_masked ? ` · ${row.phone_masked}` : ''}
          </div>
        </div>
        {row.online_at && <Badge variant="secondary">Online registrado</Badge>}
      </div>

      <div className="mt-3">
        {state?.kind === 'ok' && (
          <p role="status" className="flex items-center gap-2 text-lg font-bold text-success">
            <CheckCircle2 className="size-7" aria-hidden /> Presença registrada às {formatTime(at)}
          </p>
        )}
        {already && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md bg-success/10 p-3 font-semibold text-success"
          >
            <CheckCircle2 className="size-6 shrink-0" aria-hidden />
            Presença já registrada às {formatTime(at)}
            {by ? ` por ${by}` : ''}
          </p>
        )}
        {state?.kind === 'queued' && (
          <p role="status" className="flex items-center gap-2 font-semibold text-warning">
            <Clock3 className="size-6" aria-hidden /> Sem internet: presença guardada e aguardando envio.
          </p>
        )}
        {state?.kind === 'error' && (
          <p role="alert" className="font-medium text-destructive">
            {state.message}
          </p>
        )}
        {!done && state?.kind !== 'queued' && (
          <Button
            size="xl"
            className="mt-1 w-full bg-success text-white hover:bg-success/90"
            disabled={state?.kind === 'sending'}
            onClick={onMark}
          >
            {state?.kind === 'sending' ? 'Registrando…' : 'COMPARECEU AO EVENTO ✓'}
          </Button>
        )}
      </div>
    </li>
  )
}
