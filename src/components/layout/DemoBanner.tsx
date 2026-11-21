import { env } from '@/lib/env'

export function DemoBanner() {
  if (env.config.appEnv !== 'dev') return null
  return (
    <div
      role="status"
      className="no-print flex h-6 items-center justify-center bg-gold/15 px-4 text-[11px] font-medium tracking-[0.12em] text-navy uppercase"
    >
      Ambiente de demonstração · dados fictícios
    </div>
  )
}
