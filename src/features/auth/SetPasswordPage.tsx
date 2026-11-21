import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

/** Usada no aceite de convite (?tipo=convite) e na redefinição de senha (?tipo=recuperacao). */
export function SetPasswordPage() {
  const [params] = useSearchParams()
  const isInvite = params.get('tipo') === 'convite'
  const { session, loading, profile, refresh } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const title = isInvite ? 'Aceitar convite' : 'Redefinir senha'

  if (loading) {
    return (
      <AuthLayout title={title}>
        <Skeleton className="h-24 w-full" />
      </AuthLayout>
    )
  }

  if (!session) {
    return (
      <AuthLayout title={title}>
        <div className="space-y-4">
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-destructive">
            O link é inválido ou expirou.{' '}
            {isInvite ? 'Peça um novo convite à coordenação.' : 'Solicite um novo link.'}
          </p>
          <Button asChild className="w-full" variant="outline">
            <Link to={isInvite ? '/login' : '/recuperar-senha'}>
              {isInvite ? 'Ir para o login' : 'Pedir novo link'}
            </Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validateNewPassword(password, confirmation)
    if (problem) {
      setError(problem)
      return
    }
    if (isInvite && fullName.trim().length < 3 && !profile?.full_name) {
      setError('Informe seu nome completo.')
      return
    }
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (!error && isInvite && fullName.trim() && session) {
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', session.user.id)
    }
    setSubmitting(false)
    if (error) {
      setError(translateError(error))
      return
    }
    await refresh()
    toast.success(isInvite ? 'Cadastro concluído. Bem-vindo(a)!' : 'Senha alterada com sucesso.')
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title={title}
      description={
        isInvite
          ? `Crie sua senha para acessar com ${session.user.email}.`
          : `Crie uma nova senha para ${session.user.email}.`
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {isInvite && (
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              autoComplete="name"
              value={fullName}
              placeholder={profile?.full_name || ''}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}
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
      </form>
    </AuthLayout>
  )
}
