import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { navForRoles, type AppRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { Brand } from './Brand'
import { DemoBanner } from './DemoBanner'

interface AppShellProps {
  roles: readonly AppRole[]
  headerRight?: ReactNode
  eventSelector?: ReactNode
  eventName?: string
  logoUrl?: string | null
  children: ReactNode
}

export function AppShell({ roles, headerRight, eventSelector, eventName, logoUrl, children }: AppShellProps) {
  const [open, setOpen] = useState(false)
  const items = navForRoles(roles)

  const nav = (
    <nav aria-label="Menu principal" className="flex flex-col gap-1 p-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center rounded-md px-3 text-base font-medium text-white/85 hover:bg-white/10',
              isActive && 'bg-white/15 text-white shadow-[inset_3px_0_0_var(--gold)]',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="flex flex-1">
        <aside className="no-print hidden w-64 shrink-0 bg-navy lg:block">
          <div className="border-b border-white/10 p-4">
            <Brand eventName={eventName} logoUrl={logoUrl} light />
          </div>
          {nav}
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-navy">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <Brand eventName={eventName} logoUrl={logoUrl} light />
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fechar menu">
                  <X />
                </Button>
              </div>
              {nav}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
              <Menu />
            </Button>
            <div className="lg:hidden">
              <Brand eventName={eventName} logoUrl={logoUrl} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {eventSelector}
              {headerRight}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
          <footer className="no-print border-t px-4 py-3 text-center text-sm text-muted-foreground">
            Igreja Cristã Maranata — Polo Torre ·{' '}
            <Link to="/privacidade" className="underline underline-offset-2">
              Política de privacidade
            </Link>
          </footer>
        </div>
      </div>
    </div>
  )
}
