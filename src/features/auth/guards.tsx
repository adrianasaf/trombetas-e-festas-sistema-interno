import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/layout/Brand'
import type { AppRole } from '@/lib/roles'
import { ForbiddenPage } from '@/pages/StatusPages'
import { useAuth } from './AuthProvider'

function FullPageLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6" aria-busy="true">
      <Brand />
      <Skeleton className="h-4 w-48" />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

/** Exige sessão ativa e perfil com pelo menos uma atribuição. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, profile, roles, profileError, signOut } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Senha definida pelo Administrador: precisa criar a própria antes de usar o sistema.
  if (session.user.user_metadata?.must_change_password === true)
    return <Navigate to="/definir-senha" replace />
  if (profileError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <Brand />
        <p className="max-w-md">
          Não foi possível carregar seu perfil. Verifique a conexão e tente novamente.
        </p>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    )
  }
  if (!profile?.active || roles.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <Brand />
        <h1 className="text-2xl font-bold">Acesso ainda não liberado</h1>
        <p className="max-w-md text-muted-foreground">
          {profile && !profile.active
            ? 'Seu usuário está desativado. Fale com a coordenação do Polo.'
            : 'Seu usuário ainda não tem um perfil de acesso atribuído. Peça à coordenação da sua igreja.'}
        </p>
        <Button variant="outline" onClick={() => void signOut()}>
          Sair
        </Button>
      </div>
    )
  }
  return <>{children}</>
}

/** Exige um dos perfis informados (o banco também bloqueia via RLS). */
export function RequireRole({
  roles: allowed,
  children,
}: {
  roles: readonly AppRole[]
  children: ReactNode
}) {
  const { roles } = useAuth()
  if (!roles.some((r) => allowed.includes(r))) return <ForbiddenPage />
  return <>{children}</>
}
