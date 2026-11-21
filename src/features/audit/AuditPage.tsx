import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { translateError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'

interface AuditRow {
  id: number
  created_at: string
  user_name: string | null
  action: string
  table_name: string
  record_id: string | null
  church_name: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip: string | null
}

const ACTIONS: Record<string, string> = {
  '': 'Todas as ações',
  'attendances.': 'Presenças (marcar/desmarcar)',
  'guests.': 'Convidados',
  'duplicidade.': 'Mescla de duplicidades',
  'credito.': 'Reatribuição de crédito',
  'role_assignments.': 'Permissões',
  'events.': 'Eventos e metas',
  'metas.': 'Snapshot de metas',
  'exportacao.': 'Exportações',
  'lgpd.': 'LGPD (anonimização e titular)',
  'transport_requests.': 'Transporte',
}

const LABEL: Record<string, string> = {
  insert: 'criou',
  update: 'alterou',
  delete: 'excluiu',
  marcar: 'marcou presença',
  desmarcar: 'desmarcou presença',
}

function describe(row: AuditRow): string {
  const [scope, verb] = row.action.split('.')
  const v = LABEL[verb] ?? verb?.replace(/_/g, ' ')
  const what: Record<string, string> = {
    guests: 'convidado',
    attendances: '',
    guest_referrals: 'indicação',
    role_assignments: 'permissão',
    events: 'evento',
    event_settings: 'configurações do evento',
    profiles: 'usuário',
    duplicidade: 'duplicidade',
    credito: 'crédito do convite',
    exportacao: 'exportação',
    lgpd: 'LGPD',
    metas: 'snapshot das metas',
    transport_requests: 'transporte',
    duplicate_reviews: 'revisão de duplicidade',
  }
  return `${v ?? ''} ${what[scope] ?? scope}`.trim()
}

/** Diferenças entre antes/depois, sem colunas técnicas. */
function diff(row: AuditRow): string[] {
  const skip = new Set(['updated_at', 'created_at', 'name_normalized', 'id'])
  const a = row.old_data ?? {}
  const b = row.new_data ?? {}
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !skip.has(k))
  return keys
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .slice(0, 8)
    .map(
      (k) => `${k}: ${a[k] === undefined ? '' : `${JSON.stringify(a[k])} → `}${JSON.stringify(b[k] ?? null)}`,
    )
}

export function AuditPage() {
  const [action, setAction] = useState('')
  const q = useInfiniteQuery({
    queryKey: ['audit', action],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('list_audit_logs', {
        p_limit: 50,
        p_before_id: pageParam,
        p_action: action || null,
      })
      if (error) throw error
      return (data ?? []) as AuditRow[]
    },
    getNextPageParam: (last) => (last.length === 50 ? last[last.length - 1].id : null),
  })
  const rows = q.data?.pages.flat() ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Auditoria"
        description="Operações sensíveis registradas pelo banco. O Administrador vê tudo; o Gestor, a sua igreja."
      />
      <div className="mb-4 max-w-sm">
        <NativeSelect aria-label="Tipo de ação" value={action} onChange={(e) => setAction(e.target.value)}>
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </div>
      {q.isLoading && <Skeleton className="h-64" />}
      {q.error && (
        <p role="alert" className="text-destructive">
          {translateError(q.error)}
        </p>
      )}
      {!q.isLoading && rows.length === 0 && <EmptyState title="Nenhum registro de auditoria" />}
      <ol className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-md border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <strong>{r.user_name ?? 'Sistema'}</strong> {describe(r)}
                {r.church_name ? ` · ${r.church_name}` : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(r.created_at)}
                {r.ip ? ` · IP ${r.ip}` : ''}
              </span>
            </div>
            {diff(r).length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-muted-foreground">Detalhes</summary>
                <ul className="mt-1 space-y-0.5 break-all font-mono text-xs">
                  {diff(r).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
      {q.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  )
}
