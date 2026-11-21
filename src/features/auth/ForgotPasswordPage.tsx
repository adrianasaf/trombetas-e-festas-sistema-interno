import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translateError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/definir-senha?tipo=recuperacao`,
    })
    setSubmitting(false)
    if (error) {
      setError(translateError(error))
      return
    }
    // Mesma mensagem exista ou não o e-mail (não revela quem tem cadastro).
    setSent(true)
  }

  return (
    <AuthLayout title="Recuperar senha" description="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <div className="space-y-4">
          <p role="status" className="rounded-md bg-success/10 p-3 text-success">
            Se este e-mail tiver acesso ao sistema, você receberá o link em alguns minutos. Confira também a
            caixa de spam.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Voltar ao login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={submitting || !email}>
            {submitting ? 'Enviando…' : 'Enviar link'}
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-semibold text-primary underline underline-offset-2">
              Voltar ao login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
