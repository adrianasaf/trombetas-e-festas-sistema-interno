import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AuthLayout } from './AuthLayout'

/** Sem envio de e-mail: a senha é redefinida pelo Administrador do Polo. */
export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Esqueceu a senha?"
      description="Peça ao Administrador do Polo para definir uma nova senha para você. No próximo acesso, você cria a sua."
    >
      <Button asChild size="lg" className="w-full">
        <Link to="/login">Voltar ao login</Link>
      </Button>
    </AuthLayout>
  )
}
