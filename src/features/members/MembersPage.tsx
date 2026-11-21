import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useScope } from '@/features/auth/scope'
import { useChurches, useGroups } from '@/features/shared/queries'
import { translateError } from '@/lib/errors'
import { numberFmt } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { MemberDialog } from './MemberDialog'
import { useMembers, type MemberFilters } from './memberQueries'

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function MembersPage() {
  const scope = useScope()
  const navigate = useNavigate()
  const churches = useChurches()
  const [churchId, setChurchId] = useState('')
  const groups = useGroups(churchId || null)
  const [groupId, setGroupId] = useState('')
  const [status, setStatus] = useState<MemberFilters['status']>('ativos')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [creating, setCreating] = useState(false)
  const members = useMembers({ churchId, groupId, status, search: debounced })

  const visibleChurches = (churches.data ?? []).filter(
    (c) => scope.isAdmin || scope.managedChurchIds.includes(c.id),
  )
  const visibleGroups = (groups.data ?? []).filter((g) => scope.canManageGroup(g))

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Membros"
        description="Cada membro pertence a um grupo de assistência. Abra a ficha para ver metas e convidados."
        actions={
          <Button size="lg" onClick={() => setCreating(true)}>
            Novo membro
          </Button>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="mb-search" className="sr-only">
            Buscar por nome
          </label>
          <Input
            id="mb-search"
            type="search"
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {visibleChurches.length > 1 && (
          <div>
            <label htmlFor="mb-church" className="sr-only">
              Igreja
            </label>
            <NativeSelect
              id="mb-church"
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
          </div>
        )}
        {visibleGroups.length > 1 && (
          <div>
            <label htmlFor="mb-group" className="sr-only">
              Grupo
            </label>
            <NativeSelect id="mb-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Todos os grupos</option>
              {visibleGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div>
          <label htmlFor="mb-status" className="sr-only">
            Situação
          </label>
          <NativeSelect
            id="mb-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MemberFilters['status'])}
          >
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </NativeSelect>
        </div>
      </div>

      {members.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}
      {members.error && (
        <p role="alert" className="text-destructive">
          {translateError(members.error)}
        </p>
      )}
      {members.data && members.data.length === 0 && (
        <EmptyState
          title={search ? 'Nenhum membro encontrado' : 'Nenhum membro ainda'}
          action={
            !search && (
              <Button onClick={() => setCreating(true)} size="lg">
                Cadastrar o primeiro membro
              </Button>
            )
          }
        >
          {search ? 'Confira a grafia ou mude os filtros.' : 'Cadastre os membros do grupo para começar.'}
        </EmptyState>
      )}
      {members.data && members.data.length > 0 && (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {numberFmt.format(members.data.length)} membro(s)
            {members.data.length >= 1000 ? ' (mostrando os primeiros 1.000; refine a busca)' : ''}
          </p>
          <ul className="divide-y rounded-lg border bg-card">
            {members.data.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/membros/${m.id}`}
                  className="flex min-h-14 flex-col justify-center gap-0.5 px-4 py-2 hover:bg-secondary sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {m.full_name}
                    {!m.active && <Badge variant="destructive">Inativo</Badge>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {m.group?.name} · {m.church?.name}
                    {m.phone_normalized ? ` · ${formatPhone(m.phone_normalized)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {creating && (
        <MemberDialog
          member={null}
          defaultGroupId={groupId || undefined}
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/membros/${id}`)}
        />
      )}
    </div>
  )
}
