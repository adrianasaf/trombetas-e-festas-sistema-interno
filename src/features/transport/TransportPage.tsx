import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useScope } from '@/features/auth/scope'
import { useEvent } from '@/features/events/EventProvider'
import { useChurches, useGroups } from '@/features/shared/queries'
import { csvFilename, downloadCsv } from '@/lib/csv'
import { translateError } from '@/lib/errors'
import { formatPhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { todayIso } from '@/lib/format'

type Status = 'pendente' | 'organizado' | 'concluido'
const STATUS_LABEL: Record<Status, string> = {
  pendente: 'Pendente',
  organizado: 'Transporte organizado',
  concluido: 'Concluído',
}
const STATUS_VARIANT: Record<Status, 'warning' | 'secondary' | 'success'> = {
  pendente: 'warning',
  organizado: 'secondary',
  concluido: 'success',
}

interface Row {
  request_id: string
  guest_id: string
  full_name: string
  phone: string | null
  church_name: string
  group_name: string | null
  member_name: string | null
  status: Status
  driver_name: string | null
  pickup_point: string | null
  notes: string | null
}

export function TransportPage() {
  const qc = useQueryClient()
  const scope = useScope()
  const { current, readOnly } = useEvent()
  const churches = useChurches()
  const [churchId, setChurchId] = useState('')
  const groups = useGroups(churchId || null)
  const [groupId, setGroupId] = useState('')
  const [status, setStatus] = useState<Status | ''>('')
  const list = useQuery({
    queryKey: ['transport', current?.id, churchId, groupId, status],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('transport_list', {
        p_event_id: current!.id,
        p_church_id: churchId || null,
        p_group_id: groupId || null,
        p_status: status || null,
      })
      if (error) throw error
      return (data ?? []) as Row[]
    },
  })
  const visibleChurches = (churches.data ?? []).filter(
    (c) => scope.isAdmin || scope.managedChurchIds.includes(c.id),
  )
  // Telefone na exportação: Admin, ou Gestor com uma igreja sua filtrada (seção 14).
  const exportWithPhone = scope.isAdmin || (!!churchId && scope.managedChurchIds.includes(churchId))

  async function exportCsv() {
    const rows = list.data ?? []
    const { error } = await supabase.rpc('log_export', {
      p_kind: 'transporte',
      p_event_id: current!.id,
      p_church_id: churchId || null,
      p_rows: rows.length,
      p_with_phone: exportWithPhone,
      p_filters: { churchId, groupId, status },
    })
    if (error) return toast.error(translateError(error))
    const head = [
      'Nome',
      ...(exportWithPhone ? ['Telefone'] : []),
      'Igreja',
      'Grupo',
      'Membro responsável',
      'Situação',
      'Responsável pelo transporte',
      'Ponto de embarque',
      'Observações',
    ]
    downloadCsv(
      csvFilename('transporte', current?.name, todayIso()),
      head,
      rows.map((r) => [
        r.full_name,
        ...(exportWithPhone ? [formatPhone(r.phone)] : []),
        r.church_name,
        r.group_name ?? '',
        r.member_name ?? 'Sem membro identificado',
        STATUS_LABEL[r.status],
        r.driver_name ?? '',
        r.pickup_point ?? '',
        r.notes ?? '',
      ]),
    )
    toast.success(
      `Exportação registrada (${rows.length} linhas${exportWithPhone ? ', com telefone' : ', sem telefone'}).`,
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Transporte"
        description="Convidados presenciais (ou indefinidos) que precisam de transporte."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Imprimir / PDF
            </Button>
            <Button variant="outline" disabled={!list.data?.length} onClick={() => void exportCsv()}>
              <Download /> Exportar CSV
            </Button>
          </>
        }
      />
      <div className="no-print mb-4 grid gap-2 sm:grid-cols-3">
        {visibleChurches.length > 1 && (
          <NativeSelect
            aria-label="Igreja"
            value={churchId}
            onChange={(e) => {
              setChurchId(e.target.value)
              setGroupId('')
            }}
          >
            <option value="">Todas as igrejas</option>
            {visibleChurches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect aria-label="Grupo" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Todos os grupos</option>
          {(groups.data ?? [])
            .filter((g) => scope.canManageGroup(g))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | '')}
        >
          <option value="">Todas as situações</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {!exportWithPhone && (
        <p className="no-print mb-3 text-sm text-muted-foreground">
          A exportação sai sem telefone.{' '}
          {scope.managedChurchIds.length
            ? 'Para incluir, filtre por uma igreja sua.'
            : 'Telefones na exportação são exclusivos do Gestor da igreja e do Administrador.'}
        </p>
      )}
      {list.isLoading && <Skeleton className="h-40" />}
      {list.error && (
        <p role="alert" className="text-destructive">
          {translateError(list.error)}
        </p>
      )}
      {list.data?.length === 0 && (
        <EmptyState title="Ninguém precisa de transporte com esses filtros">
          Quando um convidado marcar “Precisa de transporte”, ele aparece aqui.
        </EmptyState>
      )}
      {!!list.data?.length && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{list.data.length} convidado(s)</p>
          {list.data.map((r) => (
            <TransportRow
              key={r.request_id}
              row={r}
              readOnly={readOnly}
              onSaved={() => void qc.invalidateQueries({ queryKey: ['transport'] })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TransportRow({ row, readOnly, onSaved }: { row: Row; readOnly: boolean; onSaved: () => void }) {
  const [status, setStatus] = useState<Status>(row.status)
  const [driver, setDriver] = useState(row.driver_name ?? '')
  const [pickup, setPickup] = useState(row.pickup_point ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')
  const dirty =
    status !== row.status ||
    driver !== (row.driver_name ?? '') ||
    pickup !== (row.pickup_point ?? '') ||
    notes !== (row.notes ?? '')
  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('transport_requests')
        .update({
          status,
          driver_name: driver.trim() || null,
          pickup_point: pickup.trim() || null,
          notes: notes.trim() || null,
        })
        .eq('id', row.request_id)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Você não tem permissão para alterar este transporte.')
    },
    onSuccess: () => {
      toast.success('Transporte atualizado.')
      onSaved()
    },
    onError: (e) => toast.error(translateError(e)),
  })
  return (
    <div className="break-inside-avoid rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={`/convidados/${row.guest_id}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {row.full_name}
          </Link>
          <div className="text-sm text-muted-foreground">
            {formatPhone(row.phone)} · {row.church_name}
            {row.group_name ? ` · ${row.group_name}` : ''} · Membro:{' '}
            {row.member_name ?? 'sem membro identificado'}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
      </div>
      <fieldset disabled={readOnly} className="no-print mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <NativeSelect
          aria-label={`Situação do transporte de ${row.full_name}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <Input
          aria-label="Responsável pelo transporte"
          placeholder="Responsável pelo transporte"
          maxLength={150}
          value={driver}
          onChange={(e) => setDriver(e.target.value)}
        />
        <Input
          aria-label="Ponto de embarque"
          placeholder="Ponto de embarque (opcional)"
          maxLength={300}
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
        />
        <Input
          aria-label="Observações do transporte"
          placeholder="Observações"
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </fieldset>
      <div className="hidden text-sm print:block">
        Responsável: {row.driver_name || '—'} · Embarque: {row.pickup_point || '—'}{' '}
        {row.notes ? `· ${row.notes}` : ''}
      </div>
      {dirty && !readOnly && (
        <div className="no-print mt-2 flex justify-end">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      )}
    </div>
  )
}
