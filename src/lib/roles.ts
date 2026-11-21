/** Perfis de acesso (seção 4). Espelham o enum public.app_role do banco. */
export const ROLES = ['polo_admin', 'church_manager', 'group_leader', 'reception', 'reader'] as const
export type AppRole = (typeof ROLES)[number]

export const ROLE_LABELS: Record<AppRole, string> = {
  polo_admin: 'Administrador do Polo',
  church_manager: 'Gestor de Igreja',
  group_leader: 'Responsável de Grupo',
  reception: 'Recepção',
  reader: 'Leitor',
}

export interface NavItem {
  to: string
  label: string
  roles: readonly AppRole[]
}

const ALL: readonly AppRole[] = ROLES

/** Menu lateral (seção 17). Cada item só aparece para os perfis listados. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard geral', roles: ALL },
  { to: '/igrejas', label: 'Igrejas', roles: ['polo_admin', 'church_manager', 'reader'] },
  { to: '/grupos', label: 'Grupos de assistência', roles: ['polo_admin', 'church_manager', 'group_leader'] },
  { to: '/membros', label: 'Membros', roles: ['polo_admin', 'church_manager', 'group_leader'] },
  { to: '/convidados', label: 'Convidados', roles: ['polo_admin', 'church_manager', 'group_leader'] },
  { to: '/check-in', label: 'Check-in', roles: ['polo_admin', 'church_manager', 'reception'] },
  { to: '/transporte', label: 'Transporte', roles: ['polo_admin', 'church_manager', 'group_leader'] },
  {
    to: '/relatorios',
    label: 'Relatórios',
    roles: ['polo_admin', 'church_manager', 'group_leader', 'reader'],
  },
  { to: '/duplicidades', label: 'Duplicidades', roles: ['polo_admin', 'church_manager'] },
  { to: '/usuarios', label: 'Usuários e permissões', roles: ['polo_admin', 'church_manager'] },
  { to: '/configuracoes', label: 'Configurações', roles: ['polo_admin'] },
  { to: '/auditoria', label: 'Auditoria', roles: ['polo_admin', 'church_manager'] },
]

export function navForRoles(roles: readonly AppRole[]): NavItem[] {
  const set = new Set(roles)
  return NAV_ITEMS.filter((item) => item.roles.some((r) => set.has(r)))
}

export function canAccess(path: string, roles: readonly AppRole[]): boolean {
  const item = NAV_ITEMS.find((i) => i.to === path)
  if (!item) return true
  return item.roles.some((r) => roles.includes(r))
}
