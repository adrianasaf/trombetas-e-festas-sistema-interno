import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ChurchOverview {
  id: string
  name: string
  city: string
  address: string | null
  active: boolean
  groups_total: number
  groups_active: number
  members_active: number
  members_total: number
}

export function useChurchOverview() {
  return useQuery({
    queryKey: ['church-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('church_overview')
      if (error) throw error
      return (data ?? []) as ChurchOverview[]
    },
  })
}
