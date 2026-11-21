import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GuestCategory } from '@/features/guests/labels'
import { IndexedDbStorage, OfflineQueue, isNetworkError, type PendingItem } from './offlineQueue'

export interface CheckinRow {
  guest_id: string
  full_name: string
  category: GuestCategory
  church_name: string
  group_name: string | null
  member_name: string | null
  phone_masked: string | null
  mode: 'presencial' | 'online' | 'indefinido'
  presencial_at: string | null
  presencial_by: string | null
  online_at: string | null
}

export interface CheckinResult {
  status: 'registrada' | 'ja_registrada'
  checked_in_at: string
  checked_in_by: string | null
  repetida?: boolean
  guest_id?: string
}

export async function searchCheckin(query: string): Promise<CheckinRow[]> {
  const { data, error } = await supabase.rpc('search_checkin', { p_query: query, p_limit: 20 })
  if (error) throw error
  return (data ?? []) as CheckinRow[]
}

export async function rpcCheckIn(
  guestId: string,
  requestId: string,
  type: 'presencial' | 'online' = 'presencial',
) {
  const { data, error } = await supabase.rpc('check_in', {
    p_guest_id: guestId,
    p_client_request_id: requestId,
    p_type: type,
  })
  if (error) throw error
  return data as CheckinResult
}

export interface WalkInInput {
  fullName: string
  category: GuestCategory
  consent: boolean
  phone: string
  memberId: string | null
  churchId: string | null
  guardianName: string
  guardianPhone: string
}

export async function rpcWalkIn(input: WalkInInput, requestId: string) {
  const { data, error } = await supabase.rpc('walk_in_check_in', {
    p_full_name: input.fullName.trim(),
    p_category: input.category,
    p_consent: input.consent,
    p_phone: input.phone.trim() || null,
    p_member_id: input.memberId,
    p_church_id: input.memberId ? null : input.churchId,
    p_guardian_name: input.guardianName.trim() || null,
    p_guardian_phone: input.guardianPhone.trim() || null,
    p_client_request_id: requestId,
  })
  if (error) throw error
  return data as CheckinResult
}

/** Fila única do aplicativo: reenvia check-ins e walk-ins pela mesma RPC idempotente. */
export const checkinQueue = new OfflineQueue(new IndexedDbStorage(), async (item) => {
  try {
    if (item.kind === 'check_in') {
      await rpcCheckIn(item.payload.guestId as string, item.id)
    } else {
      await rpcWalkIn(item.payload as unknown as WalkInInput, item.id)
    }
    return { result: 'ok' }
  } catch (e) {
    return { result: isNetworkError(e) ? 'retry' : 'drop', error: (e as Error).message }
  }
})

let started = false
/** Reenvia ao voltar a conexão, ao focar a aba e a cada 15 s. */
export function startQueueSync() {
  if (started || typeof window === 'undefined') return
  started = true
  const flush = () => void checkinQueue.flush()
  window.addEventListener('online', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && flush())
  window.setInterval(flush, 15_000)
  flush()
}

export function usePendingCheckins(): PendingItem[] {
  const [items, setItems] = useState<PendingItem[]>([])
  useEffect(() => checkinQueue.subscribe(setItems), [])
  return items
}

export function newRequestId(): string {
  return crypto.randomUUID()
}

/** Bipe curto de confirmação (Web Audio), sem arquivos externos. */
export function playSuccessSound() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.09)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.26)
    osc.onended = () => void ctx.close()
  } catch {
    /* som é opcional */
  }
}
