import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { translateError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthProvider'
import { MIN_PASSWORD_LENGTH, validateNewPassword } from './password'

/**
 * Criar/alterar a própria senha.
 * Primeiro acesso (senha definida pelo Administrador): obrigatório antes de usar o sistema.
 * Também acessível pelo menu do usuário para trocar a senha quando quiser.
 */
export function SetPasswordPage() {
  const { session, loading, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <AuthLayout title="Senha">
        <Skeleton className="h-24 w-full" />
      </AuthLayout>
    )
  }
  if (!session) return <Navigate to="/login" replace />

  const firstAccess = session.user.user_metadata?.must_change_password === true

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validateNewPassword(password, confirmation)
    if (problem) return setError(problem)
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } })
    setSubmitting(false)
    if (error) return setError(translateError(error))
    await supabase.auth.refreshSession()
    await refresh()
    toast.success(firstAccess ? 'Senha criada. Bem-vindo(a)!' : 'Senha alterada.')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title={firstAccess ? 'Crie sua senha' : 'Alterar senha'}
      description={
        firstAccess
          ? `Primeiro acesso de ${session.user.email}. Troque a senha inicial que você recebeu por uma só sua.`
          : `Nova senha para ${session.user.email}.`
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Mínimo de {MIN_PASSWORD_LENGTH} caracteres, com letras e números.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">Confirme a nova senha</Label>
          <Input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar senha'}
        </Button>
        {firstAccess ? (
          <Button type="button" variant="ghost" className="w-full" onClick={() => void signOut()}>
            Sair
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
