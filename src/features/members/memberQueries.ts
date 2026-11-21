import { useQuery, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Member {
  id: string
  full_name: string
  church_id: string
  group_id: string
  phone_normalized: string | null
  active: boolean
  joined_at: string
  inactivated_at: string | null
  created_at: string
  church: { name: string } | null
  group: { name: string } | null
}

export const MEMBER_SELECT =
  'id, full_name, church_id, group_id, phone_normalized, active, joined_at, inactivated_at, created_at, church:churches(name), group:assistance_groups(name)'

export interface MemberFilters {
  churchId?: string
  groupId?: string
  status?: 'ativos' | 'inativos' | 'todos'
  search?: string
}

export function useMembers(filters: MemberFilters) {
  return useQuery({
    queryKey: ['members', filters],
    queryFn: async () => {
      let q = supabase.from('members').select(MEMBER_SELECT).order('full_name').limit(1000)
      if (filters.churchId) q = q.eq('church_id', filters.churchId)
      if (filters.groupId) q = q.eq('group_id', filters.groupId)
      if (filters.status === 'ativos' || !filters.status) q = q.eq('active', true)
      if (filters.status === 'inativos') q = q.eq('active', false)
      const term = filters.search?.trim()
      if (term) q = q.ilike('full_name', `%${term.replace(/[%_,()]/g, ' ')}%`)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Member[]
    },
  })
}

export function useMember(id: string) {
  return useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select(MEMBER_SELECT).eq('id', id).maybeSingle()
      if (error) throw error
      return data as unknown as Member | null
    },
  })
}

export interface MemberHistoryRow {
  id: string
  changed_at: string
  from_group: { name: string } | null
  to_group: { name: string } | null
  from_church: { name: string } | null
  to_church: { name: string } | null
}

export function useMemberHistory(id: string) {
  return useQuery({
    queryKey: ['member-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_group_history')
        .select(
          'id, changed_at, from_group:assistance_groups!member_group_history_from_group_id_fkey(name), to_group:assistance_groups!member_group_history_to_group_id_fkey(name), from_church:churches!member_group_history_from_church_id_fkey(name), to_church:churches!member_group_history_to_church_id_fkey(name)',
        )
        .eq('member_id', id)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as MemberHistoryRow[]
    },
  })
}

export function invalidateMemberQueries(qc: QueryClient) {
  for (const key of ['members', 'member', 'member-history', 'group-overview', 'church-overview']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}
