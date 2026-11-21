import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { startQueueSync } from '@/features/checkin/checkinApi'
import { useRealtimeSignal } from '@/features/realtime/useRealtimeSignal'
import { RequireAuth } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/AuthProvider'
import { EventProvider, useEvent } from '@/features/events/EventProvider'
import { EventSelector, ReadOnlyBanner } from '@/features/events/EventSelector'
import { AppShell } from './AppShell'
import { UserMenu } from './UserMenu'

function Shell() {
  const { roles } = useAuth()
  const { current, logoUrl } = useEvent()
  const realtime = useRealtimeSignal()
  useEffect(() => startQueueSync(), [])
  return (
    <AppShell
      roles={roles}
      eventName={current?.name}
      logoUrl={logoUrl}
      eventSelector={<EventSelector />}
      headerRight={
        <>
          <span
            className={`hidden size-2.5 rounded-full sm:inline-block ${realtime === 'conectado' ? 'bg-success' : 'bg-warning'}`}
            title={realtime === 'conectado' ? 'Atualização em tempo real ativa' : 'Tempo real reconectando'}
            aria-label={realtime === 'conectado' ? 'Tempo real ativo' : 'Tempo real reconectando'}
            role="img"
          />
          <UserMenu />
        </>
      }
    >
      <div className="-m-4 mb-4 md:-m-6 md:mb-6">
        <ReadOnlyBanner />
      </div>
      <Outlet />
    </AppShell>
  )
}

export function ProtectedLayout() {
  return (
    <RequireAuth>
      <EventProvider>
        <Shell />
      </EventProvider>
    </RequireAuth>
  )
}
