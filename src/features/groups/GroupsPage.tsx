import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { useScope } from '@/features/auth/scope'
import { useChurches } from '@/features/shared/queries'
import { GroupDialog } from './GroupDialog'
import { GroupList } from './GroupList'

export function GroupsPage() {
  const scope = useScope()
  const churches = useChurches()
  const [churchId, setChurchId] = useState('')
  const [creating, setCreating] = useState(false)
  const canCreate = scope.isAdmin || scope.managedChurchIds.length > 0
  const visibleChurches = (churches.data ?? []).filter(
    (c) => scope.isAdmin || scope.managedChurchIds.includes(c.id),
  )

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Grupos de assistência"
        description="Cada grupo pertence a uma igreja. Inativar um grupo não apaga o histórico."
        actions={
          canCreate && (
            <Button size="lg" onClick={() => setCreating(true)}>
              Novo grupo
            </Button>
          )
        }
      />
      {visibleChurches.length > 1 && (
        <div className="mb-4 max-w-sm">
          <label htmlFor="flt-church" className="sr-only">
            Filtrar por igreja
          </label>
          <NativeSelect id="flt-church" value={churchId} onChange={(e) => setChurchId(e.target.value)}>
            <option value="">Todas as igrejas</option>
            {visibleChurches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <GroupList churchId={churchId || null} showChurch={!churchId} />
      {creating && (
        <GroupDialog
          group={null}
          defaultChurchId={churchId || undefined}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
