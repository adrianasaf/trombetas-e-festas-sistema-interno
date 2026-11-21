import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { translateError } from '@/lib/errors'
import { numberFmt } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { GuestDialog } from './GuestDialog'
import { useGuests, type GuestFilters } from './guestQueries'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  INVITE_STATUSES,
  INVITE_STATUS_LABEL,
  MODES,
  MODE_LABEL,
  TRANSPORTS,
  TRANSPORT_LABEL,
  inviteStatusLabel,
} from './labels'

export function GuestsPage() {
  const scope = useScope()
  const navigate = useNavigate()
  const { current, readOnly } = useEvent()
  const churches = useChurches()
  const [params] = useSearchParams()
  const [f, setF] = useState<Omit<GuestFilters, 'eventId'>>({
    duplicates: params.get('duplicidades') === '1',
  })
  const [search, setSearch] = useState('')
  const groups = useGroups(f.churchId || null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setF((prev) => ({ ...prev, search })), 300)
    return () => clearTimeout(t)
  }, [search])

  const guests = useGuests({ ...f, eventId: current?.id ?? null })
  const set = (patch: Partial<GuestFilters>) => setF((prev) => ({ ...prev, ...patch }))
  const visibleChurches = (churches.data ?? []).filter(
    (c) => scope.isAdmin || scope.managedChurchIds.includes(c.id),
  )
  const visibleGroups = (groups.data ?? []).filter((g) => scope.canManageGroup(g))

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Convidados"
        description={
          current ? `${current.name}. Todo convidado é cadastrado a partir de um membro.` : undefined
        }
        actions={
          !readOnly &&
          current && (
            <Button size="lg" onClick={() => setCreating(true)}>
              Novo convidado
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="search"
          aria-label="Buscar por nome ou telefone"
          placeholder="Buscar por nome ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {visibleChurches.length > 1 && (
          <NativeSelect
            aria-label="Igreja"
            value={f.churchId ?? ''}
            onChange={(e) => set({ churchId: e.target.value || undefined, groupId: undefined })}
          >
            <option value="">Todas as igrejas</option>
            {visibleChurches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {visibleGroups.length > 1 && (
          <NativeSelect
            aria-label="Grupo"
            value={f.groupId ?? ''}
            onChange={(e) => set({ groupId: e.target.value || undefined })}
          >
            <option value="">Todos os grupos</option>
            {visibleGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          aria-label="Categoria"
          value={f.category ?? ''}
          onChange={(e) => set({ category: e.target.value || undefined })}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Situação do convite"
          value={f.inviteStatus ?? ''}
          onChange={(e) => set({ inviteStatus: e.target.value || undefined })}
        >
          <option value="">Todas as situações</option>
          {INVITE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INVITE_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Modalidade"
          value={f.mode ?? ''}
          onChange={(e) => set({ mode: e.target.value || undefined })}
        >
          <option value="">Todas as modalidades</option>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Transporte"
          value={f.transport ?? ''}
          onChange={(e) => set({ transport: e.target.value || undefined })}
        >
          <option value="">Qualquer transporte</option>
          {TRANSPORTS.map((t) => (
            <option key={t} value={t}>
              {TRANSPORT_LABEL[t]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Marcação especial"
          value={f.special ?? ''}
          onChange={(e) => set({ special: e.target.value as GuestFilters['special'] })}
        >
          <option value="">Sem filtro de marcação</option>
          <option value="autoridade">Autoridades</option>
          <option value="pastor">Pastores de outra igreja</option>
        </NativeSelect>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-[var(--navy)]"
            checked={!!f.duplicates}
            onChange={(e) => set({ duplicates: e.target.checked })}
          />
          Só possíveis duplicidades
        </label>
      </div>

      {guests.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}
      {guests.error && (
        <p role="alert" className="text-destructive">
          {translateError(guests.error)}
        </p>
      )}
      {guests.data?.length === 0 && (
        <EmptyState
          title={
            search || Object.values(f).some(Boolean)
              ? 'Nenhum convidado com esses filtros'
              : 'Nenhum convidado ainda — cadastre o primeiro'
          }
        >
          Convidados também podem ser cadastrados rapidamente pela ficha de cada membro.
        </EmptyState>
      )}
      {!!guests.data?.length && (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {numberFmt.format(guests.data.length)} convidado(s)
            {guests.data.length >= 1000 ? ' — mostrando os primeiros 1.000; refine a busca' : ''}
          </p>
          <ul className="divide-y rounded-lg border bg-card">
            {guests.data.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/convidados/${g.id}`}
                  className="flex min-h-14 flex-col justify-center gap-1 px-4 py-2 hover:bg-secondary md:flex-row md:items-center md:justify-between"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{g.full_name}</span>
                    {g.possible_duplicate && <Badge variant="warning">Possível duplicidade</Badge>}
                    {g.is_authority && <Badge variant="gold">Autoridade</Badge>}
                    {g.is_other_church_pastor && <Badge variant="gold">Pastor</Badge>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {g.member?.full_name ?? 'Sem membro identificado'} · {g.group?.name ?? g.church?.name} ·{' '}
                    {inviteStatusLabel(g.invite_status, g.mode)}
                    {g.phone_normalized || g.guardian_phone
                      ? ` · ${formatPhone(g.phone_normalized ?? g.guardian_phone)}`
                      : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {creating && (
        <GuestDialog
          guest={null}
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/convidados/${id}`)}
        />
      )}
    </div>
  )
}
