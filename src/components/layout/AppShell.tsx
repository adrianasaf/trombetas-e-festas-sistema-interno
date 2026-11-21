import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  BarChart3,
  Bus,
  Church,
  ClipboardCheck,
  Copy,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { navForRoles, type AppRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { Brand } from './Brand'
import { DemoBanner } from './DemoBanner'

/** Ícones lucide em traço fino e cor única (o item ativo ganha o filete dourado). */
const ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/igrejas': Church,
  '/grupos': Users,
  '/membros': UserRound,
  '/convidados': FileText,
  '/check-in': ClipboardCheck,
  '/transporte': Bus,
  '/relatorios': BarChart3,
  '/duplicidades': Copy,
  '/usuarios': UserCog,
  '/configuracoes': Settings,
  '/auditoria': ShieldCheck,
}

interface AppShellProps {
  roles: readonly AppRole[]
  headerRight?: ReactNode
  eventSelector?: ReactNode
  eventName?: string
  /** Texto curto da data do evento para o cabeçalho (ex.: "28 de novembro · 17h"). */
  eventDate?: string | null
  logoUrl?: string | null
  children: ReactNode
}

export function AppShell({
  roles,
  headerRight,
  eventSelector,
  eventName,
  eventDate,
  logoUrl,
  children,
}: AppShellProps) {
  const [open, setOpen] = useState(false)
  const items = navForRoles(roles)

  const nav = (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5 px-3 py-4">
      {items.map((item) => {
        const Icon = ICONS[item.to] ?? LayoutDashboard
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'group relative flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.95rem] text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-gold-bright',
                isActive && 'bg-white/[0.09] font-semibold text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-gold transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon
                  aria-hidden
                  strokeWidth={1.6}
                  className={cn('size-[18px] shrink-0', isActive ? 'text-gold-bright' : 'text-white/70')}
                />
                {item.label}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )

  const brandBlock = (
    <div className="px-5 pt-6 pb-5">
      <Brand eventName={eventName} logoUrl={logoUrl} light />
      <div className="gold-rule mt-5 opacity-70" />
    </div>
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="flex flex-1">
        <aside className="no-print hidden w-64 shrink-0 bg-navy lg:block">
          <div className="sticky top-0">
            {brandBlock}
            {nav}
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-navy">
              <div className="flex items-start justify-between">
                {brandBlock}
                <Button
                  variant="ghost"
                  size="icon"
                  className="m-2 text-white hover:bg-white/10"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar menu"
                >
                  <X strokeWidth={1.6} />
                </Button>
              </div>
              {nav}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-card/95 px-4 py-2 backdrop-blur md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu strokeWidth={1.6} />
            </Button>
            <div className="min-w-0">
              <div className="truncate font-[family-name:var(--font-display)] text-lg leading-tight font-bold sm:text-xl">
                {eventName ?? 'Trombetas e Festas'}
              </div>
              {eventDate && <div className="eyebrow truncate !tracking-[0.14em]">{eventDate}</div>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {eventSelector}
              {headerRight}
            </div>
          </header>
          <main className="flex-1 px-4 py-5 md:px-8 md:py-7">{children}</main>
          <footer className="no-print border-t border-border/70 px-4 py-4 text-center text-xs text-muted-foreground">
            Igreja Cristã Maranata · Polo Torre ·{' '}
            <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">
              Política de privacidade
            </Link>
          </footer>
        </div>
      </div>
    </div>
  )
}
