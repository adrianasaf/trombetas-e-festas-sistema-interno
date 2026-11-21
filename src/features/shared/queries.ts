import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Church {
  id: string
  name: string
  city: string
  address: string | null
  active: boolean
}

export interface Group {
  id: string
  church_id: string
  name: string
  leader_name: string
  leader_user_id: string | null
  assistant_leader_name: string | null
  active: boolean
}

export function useChurches() {
  return useQuery({
    queryKey: ['churches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churches')
        .select('id, name, city, address, active')
        .order('name')
      if (error) throw error
      return (data ?? []) as Church[]
    },
    staleTime: 60_000,
  })
}

export function useGroups(churchId?: string | null) {
  return useQuery({
    queryKey: ['groups', churchId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('assistance_groups')
        .select('id, church_id, name, leader_name, leader_user_id, assistant_leader_name, active')
        .order('name')
      if (churchId) q = q.eq('church_id', churchId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Group[]
    },
    staleTime: 30_000,
  })
}
