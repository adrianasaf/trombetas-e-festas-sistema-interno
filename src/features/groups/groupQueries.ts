import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface GroupOverview {
  id: string
  church_id: string
  church_name: string
  name: string
  leader_name: string
  leader_user_id: string | null
  assistant_leader_name: string | null
  active: boolean
  members_active: number
  members_total: number
}

export function useGroupOverview(churchId?: string | null) {
  return useQuery({
    queryKey: ['group-overview', churchId ?? 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('group_overview', { p_church_id: churchId ?? null })
      if (error) throw error
      return (data ?? []) as GroupOverview[]
    },
  })
}
