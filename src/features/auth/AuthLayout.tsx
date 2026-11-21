import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '@/components/layout/Brand'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,_#1f3263,_var(--navy)_60%)]">
      <DemoBanner />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
        <Brand light className="text-center" />
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description && <CardDescription className="text-base">{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        <Link to="/privacidade" className="text-sm text-white/80 underline underline-offset-2">
          Política de privacidade
        </Link>
      </div>
    </div>
  )
}
