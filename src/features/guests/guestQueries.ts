import { useQuery, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GuestCategory, InviteStatus, ParticipationMode, TransportNeed } from './labels'

export interface Guest {
  id: string
  event_id: string
  full_name: string
  phone_normalized: string | null
  category: GuestCategory
  is_authority: boolean
  is_other_church_pastor: boolean
  mode: ParticipationMode
  transport: TransportNeed | null
  invite_status: InviteStatus
  notes: string | null
  guardian_name: string | null
  guardian_phone: string | null
  church_id: string
  group_id: string | null
  member_id: string | null
  possible_duplicate: boolean
  merged_into_id: string | null
  is_walk_in: boolean
  anonymized_at: string | null
  created_at: string
  church: { name: string } | null
  group: { name: string } | null
  member: { full_name: string } | null
}

export const GUEST_SELECT =
  'id, event_id, full_name, phone_normalized, category, is_authority, is_other_church_pastor, mode, transport, invite_status, notes, guardian_name, guardian_phone, church_id, group_id, member_id, possible_duplicate, merged_into_id, is_walk_in, anonymized_at, created_at, church:churches(name), group:assistance_groups(name), member:members(full_name)'

export interface GuestFilters {
  eventId: string | null
  churchId?: string
  groupId?: string
  memberId?: string
  category?: string
  inviteStatus?: string
  mode?: string
  transport?: string
  special?: '' | 'autoridade' | 'pastor'
  duplicates?: boolean
  search?: string
}

export function useGuests(filters: GuestFilters) {
  return useQuery({
    queryKey: ['guests', filters],
    enabled: !!filters.eventId,
    queryFn: async () => {
      let q = supabase
        .from('guests')
        .select(GUEST_SELECT)
        .eq('event_id', filters.eventId as string)
        .is('merged_into_id', null)
        .order('full_name')
        .limit(1000)
      if (filters.churchId) q = q.eq('church_id', filters.churchId)
      if (filters.groupId) q = q.eq('group_id', filters.groupId)
      if (filters.memberId) q = q.eq('member_id', filters.memberId)
      if (filters.category) q = q.eq('category', filters.category)
      if (filters.inviteStatus) q = q.eq('invite_status', filters.inviteStatus)
      if (filters.mode) q = q.eq('mode', filters.mode)
      if (filters.transport) q = q.eq('transport', filters.transport)
      if (filters.special === 'autoridade') q = q.eq('is_authority', true)
      if (filters.special === 'pastor') q = q.eq('is_other_church_pastor', true)
      if (filters.duplicates) q = q.eq('possible_duplicate', true)
      const term = filters.search?.trim().replace(/[%_,()]/g, ' ')
      if (term) {
        const digits = term.replace(/\D/g, '')
        q =
          digits.length >= 4
            ? q.or(`phone_normalized.ilike.%${digits}%,guardian_phone.ilike.%${digits}%`)
            : q.ilike('full_name', `%${term}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Guest[]
    },
  })
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: ['guest', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('guests').select(GUEST_SELECT).eq('id', id).maybeSingle()
      if (error) throw error
      return data as unknown as Guest | null
    },
  })
}

export function invalidateGuestQueries(qc: QueryClient) {
  for (const key of ['guests', 'guest', 'guest-extra', 'member-goal', 'duplicates', 'stats']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}

export interface CreateGuestInput {
  memberId: string
  fullName: string
  phone: string
  category: GuestCategory
  consent: boolean
  mode: ParticipationMode
  transport: TransportNeed | null
  inviteStatus: InviteStatus
  isAuthority: boolean
  isPastor: boolean
  notes: string
  guardianName: string
  guardianPhone: string
}

export async function createGuest(input: CreateGuestInput) {
  const { data, error } = await supabase.rpc('create_guest', {
    p_member_id: input.memberId,
    p_full_name: input.fullName.trim(),
    p_phone: input.phone.trim() || null,
    p_category: input.category,
    p_consent: input.consent,
    p_mode: input.mode,
    p_transport: input.mode === 'online' ? null : (input.transport ?? 'indefinido'),
    p_invite_status: input.inviteStatus,
    p_is_authority: input.isAuthority,
    p_is_other_church_pastor: input.isPastor,
    p_notes: input.notes.trim() || null,
    p_guardian_name: input.guardianName.trim() || null,
    p_guardian_phone: input.guardianPhone.trim() || null,
  })
  if (error) throw error
  return data as { id: string; possible_duplicate: boolean; duplicates: number }
}
