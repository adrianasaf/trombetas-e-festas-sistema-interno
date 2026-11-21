import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/layout/Brand'

function StatusLayout({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Brand />
      <div className="num font-[family-name:var(--font-display)] text-7xl font-bold text-sky">{code}</div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-md text-muted-foreground">{text}</p>
      <Button asChild size="lg">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <StatusLayout
      code="404"
      title="Página não encontrada"
      text="O endereço acessado não existe ou foi removido."
    />
  )
}

export function ForbiddenPage() {
  return (
    <StatusLayout
      code="403"
      title="Acesso não permitido"
      text="Seu perfil não tem permissão para acessar esta área. Se precisar, fale com a coordenação da sua igreja."
    />
  )
}

export function ConfigErrorPage({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Brand />
      <h1 className="text-2xl font-bold">Configuração incompleta</h1>
      <p className="max-w-md text-muted-foreground">
        O sistema não encontrou as variáveis de ambiente obrigatórias. Configure-as no arquivo{' '}
        <code>.env.local</code> (desenvolvimento) ou no painel da Vercel (publicação):
      </p>
      <ul className="font-mono text-sm">
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  )
}
