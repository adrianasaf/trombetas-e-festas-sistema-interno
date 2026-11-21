import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedLayout } from '@/components/layout/ProtectedLayout'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetPasswordPage } from '@/features/auth/SetPasswordPage'
import { UsersPage } from '@/features/users/UsersPage'
import { ChurchesPage } from '@/features/churches/ChurchesPage'
import { ChurchDetailPage } from '@/features/churches/ChurchDetailPage'
import { GroupsPage } from '@/features/groups/GroupsPage'
import { GroupDetailPage } from '@/features/groups/GroupDetailPage'
import { MembersPage } from '@/features/members/MembersPage'
import { MemberDetailPage } from '@/features/members/MemberDetailPage'
import { GuestsPage } from '@/features/guests/GuestsPage'
import { GuestDetailPage } from '@/features/guests/GuestDetailPage'
import { MemberGuestsSection } from '@/features/guests/QuickGuestRows'
import { DuplicatesPage } from '@/features/duplicates/DuplicatesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { MemberGoalCard } from '@/features/goals/MemberGoalCard'
import { CheckInPage } from '@/features/checkin/CheckInPage'
import { AttendanceCard } from '@/features/checkin/AttendanceCard'
import { NAV_ITEMS } from '@/lib/roles'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ChurchPanel, GroupPanel } from '@/features/dashboard/Panels'
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
        <Route index element={<DashboardPage />} />
        <Route path="usuarios" element={guarded('/usuarios', <UsersPage />)} />
        <Route path="igrejas" element={guarded('/igrejas', <ChurchesPage />)} />
        <Route
          path="igrejas/:id"
          element={guarded(
            '/igrejas',
            <ChurchDetailPage statsSlot={(id) => <ChurchPanel churchId={id} />} />,
          )}
        />
        <Route path="grupos" element={guarded('/grupos', <GroupsPage />)} />
        <Route
          path="grupos/:id"
          element={guarded(
            '/grupos',
            <GroupDetailPage performanceSlot={(id) => <GroupPanel groupId={id} />} />,
          )}
        />
        <Route path="membros" element={guarded('/membros', <MembersPage />)} />
        <Route
          path="membros/:id"
          element={guarded(
            '/membros',
            <MemberDetailPage
              goalSlot={(memberId) => <MemberGoalCard memberId={memberId} />}
              guestsSlot={(memberId, active) => (
                <MemberGuestsSection memberId={memberId} memberActive={active} />
              )}
            />,
          )}
        />
        <Route path="convidados" element={guarded('/convidados', <GuestsPage />)} />
        <Route
          path="convidados/:id"
          element={guarded(
            '/convidados',
            <GuestDetailPage attendanceSlot={(g) => <AttendanceCard guest={g} />} />,
          )}
        />
        <Route path="check-in" element={guarded('/check-in', <CheckInPage />)} />
        <Route path="duplicidades" element={guarded('/duplicidades', <DuplicatesPage />)} />
        <Route path="configuracoes" element={guarded('/configuracoes', <SettingsPage />)} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
