import { env } from '@/lib/env'

export function DemoBanner() {
  if (env.config.appEnv !== 'dev') return null
  return (
    <div
      role="status"
      className="no-print bg-gold px-4 py-1 text-center text-[0.7rem] font-semibold tracking-[0.2em] text-navy uppercase"
    >
      Ambiente de demonstração · dados fictícios
    </div>
  )
}
