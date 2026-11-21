import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedLayout } from '@/components/layout/ProtectedLayout'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetPasswordPage } from '@/features/auth/SetPasswordPage'
import { UsersPage } from '@/features/users/UsersPage'
import { NAV_ITEMS } from '@/lib/roles'
import { HomePage } from '@/pages/HomePage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { NotFoundPage } from '@/pages/StatusPages'

function guarded(path: string, element: ReactNode) {
  const item = NAV_ITEMS.find((i) => i.to === path)
  return item ? <RequireRole roles={item.roles}>{element}</RequireRole> : element
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
      <Route path="/definir-senha" element={<SetPasswordPage />} />
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<HomePage />} />
        <Route path="usuarios" element={guarded('/usuarios', <UsersPage />)} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
