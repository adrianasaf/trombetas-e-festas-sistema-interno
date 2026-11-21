import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DemoBanner } from '@/components/layout/DemoBanner'

const ART = '/brand/trombetas-2026.png'

/**
 * Login, recuperação e definição de senha.
 * Desktop: arte oficial inteira, sem corte (object-contain sobre o azul-céu da própria arte).
 * Celular/tablet: faixa azul-céu lisa com o nome do evento — a arte completa ficaria ilegível.
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
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex h-28 items-center justify-center bg-sky px-6 text-center lg:hidden">
          <p className="font-[family-name:var(--font-display)] text-[1.75rem] leading-tight font-bold tracking-wide text-white uppercase">
            Trombetas e Festas
          </p>
        </div>
        <div className="hidden items-end bg-sky lg:flex" aria-hidden>
          <img src={ART} alt="" className="h-auto w-full object-contain" />
        </div>
        <main className="flex items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-[380px]">
            <p className="eyebrow">Polo Torre · Igreja Cristã Maranata</p>
            <h1 className="mt-2 text-[2.25rem]">{title}</h1>
            {description ? (
              <p className="mt-2 mb-8 text-muted-foreground">{description}</p>
            ) : (
              <div className="mb-8" />
            )}
            {children}
            <p className="mt-12 text-center text-sm text-muted-foreground">
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
