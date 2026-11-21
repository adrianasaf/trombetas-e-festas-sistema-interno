import { cn } from '@/lib/utils'

interface BrandProps {
  eventName?: string
  logoUrl?: string | null
  className?: string
  light?: boolean
}

/** Sem logomarca oficial enviada, exibe apenas o nome do evento em tipografia (seção 3). */
export function Brand({ eventName = 'Trombetas e Festas', logoUrl, className, light }: BrandProps) {
  if (logoUrl) {
    return <img src={logoUrl} alt={eventName} className={cn('h-10 w-auto object-contain', className)} />
  }
  return (
    <div className={cn('leading-tight', className)}>
      <div className={cn('font-[family-name:var(--font-display)] text-xl font-bold', light ? 'text-white' : 'text-navy')}>
        {eventName}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gold">ICM · Polo Torre</div>
    </div>
  )
}
