import { Outlet } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/AuthProvider'
import { AppShell } from './AppShell'
import { UserMenu } from './UserMenu'

function Shell() {
  const { roles } = useAuth()
  return (
    <AppShell roles={roles} headerRight={<UserMenu />}>
      <Outlet />
    </AppShell>
  )
}

export function ProtectedLayout() {
  return (
    <RequireAuth>
      <Shell />
    </RequireAuth>
  )
}
