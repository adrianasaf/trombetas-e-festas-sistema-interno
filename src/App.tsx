import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { NotFoundPage } from '@/pages/StatusPages'

export function App() {
  return (
    <Routes>
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route
        path="/"
        element={
          <AppShell roles={[]}>
            <HomePage />
          </AppShell>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
