import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DemoBanner } from '@/components/layout/DemoBanner'

const ART = '/brand/trombetas-2026.png'

/**
 * Login, recuperação e definição de senha. A arte oficial do evento ocupa metade da tela no
 * desktop e uma faixa no topo do celular; o formulário fica limpo ao lado.
 */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <DemoBanner />
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div
          className="relative aspect-[2/1] w-full overflow-hidden bg-sky lg:aspect-auto lg:h-auto"
          aria-hidden
        >
          <img
            src={ART}
            alt=""
            className="absolute inset-0 h-full w-full object-cover lg:object-[3%_center]"
          />
        </div>
        <main className="flex items-start justify-center px-4 py-8 sm:items-center sm:px-8">
          <div className="w-full max-w-sm">
            <p className="eyebrow">Polo Torre · Igreja Cristã Maranata</p>
            <h1 className="mt-2 text-[2.25rem]">{title}</h1>
            <div className="gold-rule mt-3 mb-5 w-24" />
            {description && <p className="mb-6 text-muted-foreground">{description}</p>}
            {children}
            <p className="mt-10 text-center text-sm text-muted-foreground">
              <Link to="/privacidade" className="underline underline-offset-4 hover:text-foreground">
                Política de privacidade
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
