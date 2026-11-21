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

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Fortaleza',
})
const eventDateLabel = (iso: string) => dateFmt.format(new Date(iso)).replace(':00', 'h')

function Shell() {
  const { roles } = useAuth()
  const { current, logoUrl } = useEvent()
  const realtime = useRealtimeSignal()
  useEffect(() => startQueueSync(), [])
  return (
    <AppShell
      roles={roles}
      eventName={current?.name}
      eventDate={current?.starts_at ? eventDateLabel(current.starts_at) : null}
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
      <div className="-mx-4 -mt-5 mb-5 md:-mx-8 md:-mt-7 md:mb-7">
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
