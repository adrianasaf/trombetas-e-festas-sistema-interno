import { env } from '@/lib/env'

export function DemoBanner() {
  if (env.config.appEnv !== 'dev') return null
  return (
    <div
      role="status"
      className="no-print bg-gold px-4 py-1.5 text-center text-sm font-bold uppercase tracking-wide text-navy"
    >
      Ambiente de demonstração — dados fictícios
    </div>
  )
}
