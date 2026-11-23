import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, KeyRound, LogOut, MonitorSmartphone, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_LABELS } from '@/lib/roles'

export function UserMenu() {
  const { profile, assignments, signOut } = useAuth()
  const navigate = useNavigate()
  const label = profile?.full_name || profile?.email || 'Usuário'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-secondary">
        <UserRound className="size-5" aria-hidden />
        <span className="hidden max-w-40 truncate text-sm font-semibold sm:inline">{label}</span>
        <ChevronDown className="size-4" aria-hidden />
        <span className="sr-only">Menu do usuário</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-64 rounded-md border bg-card p-1 shadow-lg"
        >
          <div className="px-3 py-2">
            <div className="truncate font-semibold">{label}</div>
            <div className="truncate text-sm text-muted-foreground">{profile?.email}</div>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {assignments.map((a) => (
                <li key={a.id}>
                  {ROLE_LABELS[a.role]}
                  {a.group?.name ? ` · ${a.group.name}` : a.church?.name ? ` · ${a.church.name}` : ''}
                </li>
              ))}
            </ul>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-3 outline-none data-[highlighted]:bg-secondary"
            onSelect={() => navigate('/definir-senha')}
          >
            <KeyRound className="size-4" /> Alterar minha senha
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-3 outline-none data-[highlighted]:bg-secondary"
            onSelect={() => void signOut('local')}
          >
            <LogOut className="size-4" /> Sair
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-3 outline-none data-[highlighted]:bg-secondary"
            onSelect={async () => {
              await signOut('global')
              toast.success('Sessão encerrada em todos os dispositivos.')
            }}
          >
            <MonitorSmartphone className="size-4" /> Sair de todos os dispositivos
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
