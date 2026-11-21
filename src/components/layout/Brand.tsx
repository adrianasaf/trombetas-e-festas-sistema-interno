import { cn } from '@/lib/utils'

interface BrandProps {
  eventName?: string
  logoUrl?: string | null
  className?: string
  /** true quando sobre o azul-profundo (menu lateral, faixas escuras). */
  light?: boolean
}

/**
 * Marca do sistema: nome do evento em serifada clássica, como na arte oficial.
 * Não recria a logo da Igreja; se o Admin enviar uma logomarca, ela é exibida como imagem.
 */
export function Brand({ eventName = 'Trombetas e Festas', logoUrl, className, light }: BrandProps) {
  if (logoUrl) {
    return <img src={logoUrl} alt={eventName} className={cn('h-10 w-auto object-contain', className)} />
  }
  const year = eventName.match(/\b(20\d{2})\b/)?.[1]
  const name = year ? eventName.replace(year, '').trim() : eventName
  return (
    <div className={cn('leading-none', className)}>
      <div
        className={cn(
          'font-[family-name:var(--font-display)] text-[1.35rem] font-bold tracking-wide uppercase',
          light ? 'text-white' : 'text-navy',
        )}
      >
        {name}
      </div>
      <div
        className={cn(
          'mt-1 text-[0.68rem] font-semibold tracking-[0.32em] uppercase',
          light ? 'text-gold-bright' : 'text-muted-foreground',
        )}
      >
        {year ? `${year.split('').join(' ')} · ` : ''}Polo Torre
      </div>
    </div>
  )
}
