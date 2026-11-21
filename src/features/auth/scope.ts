import { useMemo } from 'react'
import type { Group } from '@/features/shared/queries'
import { useAuth } from './AuthProvider'

export interface Scope {
  isAdmin: boolean
  managedChurchIds: string[]
  ledGroupIds: string[]
  /** Pode criar/editar grupos nesta igreja */
  canManageChurch: (churchId: string) => boolean
  /** Pode criar/editar membros e convidados deste grupo */
  canManageGroup: (group: Pick<Group, 'id' | 'church_id'>) => boolean
}

/**
 * Espelha no frontend o escopo calculado pelo banco (private.my_managed_church_ids /
 * my_led_group_ids). Serve só para mostrar ou esconder ações: quem decide é a RLS.
 */
export function useScope(): Scope {
  const { assignments, isAdmin } = useAuth()
  return useMemo(() => {
    const managedChurchIds = assignments
      .filter((a) => a.role === 'church_manager' && a.church_id)
      .map((a) => a.church_id as string)
    const ledGroupIds = assignments
      .filter((a) => a.role === 'group_leader' && a.group_id)
      .map((a) => a.group_id as string)
    const canManageChurch = (churchId: string) => isAdmin || managedChurchIds.includes(churchId)
    return {
      isAdmin,
      managedChurchIds,
      ledGroupIds,
      canManageChurch,
      canManageGroup: (g) => canManageChurch(g.church_id) || ledGroupIds.includes(g.id),
    }
  }, [assignments, isAdmin])
}
