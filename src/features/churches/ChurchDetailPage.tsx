import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useScope } from '@/features/auth/scope'
import { GroupDialog } from '@/features/groups/GroupDialog'
import { GroupList } from '@/features/groups/GroupList'
import { numberFmt } from '@/lib/format'
import { NotFoundPage } from '@/pages/StatusPages'
import { useChurchOverview } from './churchQueries'

export function ChurchDetailPage({ statsSlot }: { statsSlot?: (churchId: string) => React.ReactNode }) {
  const { id = '' } = useParams()
  const scope = useScope()
  const overview = useChurchOverview()
  const [creating, setCreating] = useState(false)
  const church = overview.data?.find((c) => c.id === id)

  if (overview.isLoading) return <Skeleton className="mx-auto h-40 max-w-5xl" />
  if (!church) return <NotFoundPage />

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <nav className="text-sm text-muted-foreground">
        <Link to="/igrejas" className="underline underline-offset-2">
          Igrejas
        </Link>{' '}
        › {church.name}
      </nav>
      <PageHeader
        title={church.name}
        description={
          <>
            {church.city}
            {church.address ? ` · ${church.address}` : ''}{' '}
            {!church.active && <Badge variant="destructive">Inativa</Badge>}
          </>
        }
        actions={
          scope.canManageChurch(church.id) &&
          church.active && (
            <Button size="lg" onClick={() => setCreating(true)}>
              Novo grupo
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Grupos ativos" value={church.groups_active} />
        <Stat label="Grupos (total)" value={church.groups_total} />
        <Stat label="Membros ativos" value={church.members_active} />
        <Stat label="Membros (total)" value={church.members_total} />
      </div>
      {statsSlot?.(church.id)}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Grupos de assistência</h2>
        <GroupList churchId={church.id} />
      </section>
      {creating && (
        <GroupDialog group={null} defaultChurchId={church.id} onClose={() => setCreating(false)} />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{numberFmt.format(value)}</div>
      </CardContent>
    </Card>
  )
}
