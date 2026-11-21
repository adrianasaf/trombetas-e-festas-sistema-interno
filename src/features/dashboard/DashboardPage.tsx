import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/empty-state'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthProvider'
import { useChurchOverview } from '@/features/churches/churchQueries'
import { useEvent } from '@/features/events/EventProvider'
import { EventHero } from './EventHero'
import { ChurchPanel, GroupPanel, PoloDashboard } from './Panels'

/**
 * Dashboard conforme o escopo: Polo (Admin, Recepção, Leitor do Polo), igreja (Gestor, Leitor da igreja)
 * ou grupo (Responsável). O banco aplica o mesmo escopo nas RPCs.
 */
export function DashboardPage() {
  const { assignments } = useAuth()
  const { current, loading } = useEvent()
  const churches = useChurchOverview()
  const [churchId, setChurchId] = useState('')

  const polo = assignments.some(
    (a) => a.role === 'polo_admin' || a.role === 'reception' || (a.role === 'reader' && !a.church_id),
  )
  const churchRoles = assignments.filter(
    (a) => (a.role === 'church_manager' || a.role === 'reader') && a.church_id,
  )
  const ledGroups = assignments.filter((a) => a.role === 'group_leader' && a.group_id)

  if (loading) return <Skeleton className="h-64" />
  if (!current) {
    return (
      <EmptyState title="Nenhuma edição do evento cadastrada">
        O Administrador do Polo cria a edição em Configurações. Até lá, os painéis ficam vazios.
      </EmptyState>
    )
  }

  const header = (
    <>
      <EventHero event={current} />
      <PageHeader
        title={polo ? 'Visão geral do Polo' : 'Painel'}
        description={<>Os números se atualizam sozinhos, em tempo real.</>}
      />
    </>
  )

  if (polo) {
    return (
      <div className="mx-auto max-w-7xl">
        {header}
        <PoloDashboard />
      </div>
    )
  }

  if (churchRoles.length) {
    const options = (churches.data ?? []).filter((c) => churchRoles.some((a) => a.church_id === c.id))
    const selected = churchId || options[0]?.id || churchRoles[0].church_id!
    const name = options.find((c) => c.id === selected)?.name
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        {header}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">
            <Link to={`/igrejas/${selected}`} className="hover:underline">
              {name ?? 'Igreja'}
            </Link>
          </h2>
          {options.length > 1 && (
            <div className="max-w-xs">
              <NativeSelect
                aria-label="Igreja"
                value={selected}
                onChange={(e) => setChurchId(e.target.value)}
              >
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
        <ChurchPanel key={selected} churchId={selected} />
      </div>
    )
  }

  if (ledGroups.length) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        {header}
        {ledGroups.map((a) => (
          <section key={a.id} className="space-y-3">
            <h2 className="text-xl font-bold">
              <Link to={`/grupos/${a.group_id}`} className="hover:underline">
                {a.group?.name ?? 'Grupo'}
              </Link>
            </h2>
            <GroupPanel groupId={a.group_id!} />
          </section>
        ))}
      </div>
    )
  }

  return <EmptyState title="Sem painel para o seu perfil">Fale com a coordenação da sua igreja.</EmptyState>
}
