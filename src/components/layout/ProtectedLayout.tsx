import { Outlet } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/AuthProvider'
import { EventProvider, useEvent } from '@/features/events/EventProvider'
import { EventSelector, ReadOnlyBanner } from '@/features/events/EventSelector'
import { AppShell } from './AppShell'
import { UserMenu } from './UserMenu'

function Shell() {
  const { roles } = useAuth()
  const { current, logoUrl } = useEvent()
  return (
    <AppShell
      roles={roles}
      eventName={current?.name}
      logoUrl={logoUrl}
      eventSelector={<EventSelector />}
      headerRight={<UserMenu />}
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
