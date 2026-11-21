import { useQuery } from '@tanstack/react-query'
import { toNumbers } from '@/features/goals/goalQueries'
import type { GuestCategory } from '@/features/guests/labels'
import { formatPercent, numberFmt } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export interface Scope3 {
  eventId: string | null | undefined
  churchId?: string | null
  groupId?: string | null
}

const args = (s: Scope3) => ({
  p_event_id: s.eventId,
  p_church_id: s.churchId ?? null,
  p_group_id: s.groupId ?? null,
})
const key = (name: string, s: Scope3) => ['stats', name, s.eventId, s.churchId ?? null, s.groupId ?? null]

export function useDaily(s: Scope3) {
  return useQuery({
    queryKey: key('daily', s),
    enabled: !!s.eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_daily', args(s))
      if (error) throw error
      return ((data ?? []) as { day: string; invites: number; attendances: number }[]).map(toNumbers)
    },
  })
}

export function useCategories(s: Scope3) {
  return useQuery({
    queryKey: key('categories', s),
    enabled: !!s.eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_categories', args(s))
      if (error) throw error
      return (
        (data ?? []) as { category: GuestCategory; guests: number; present: number; online: number }[]
      ).map(toNumbers)
    },
  })
}

export function useTransportStats(s: Scope3) {
  return useQuery({
    queryKey: key('transport', s),
    enabled: !!s.eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_transport', args(s))
      if (error) throw error
      return ((data ?? []) as { status: 'pendente' | 'organizado' | 'concluido'; total: number }[]).map(
        toNumbers,
      )
    },
  })
}

/** "21/11" a partir de "2026-11-21". */
export function shortDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Preenche dias sem movimento entre o primeiro e o último para a linha não "pular" datas. */
export function fillDays<T extends { day: string }>(rows: T[], empty: (day: string) => T): T[] {
  if (rows.length < 2) return rows
  const out: T[] = []
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const start = new Date(`${rows[0].day}T12:00:00Z`)
  const end = new Date(`${rows[rows.length - 1].day}T12:00:00Z`)
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const iso = d.toISOString().slice(0, 10)
    out.push(byDay.get(iso) ?? empty(iso))
  }
  return out
}

/** Percentual com o absoluto ao lado (ex.: "82% — 246/300"). */
export function pctLabel(value: number, goal: number, pct: number | null): string {
  return `${formatPercent(pct)} — ${numberFmt.format(value)}/${numberFmt.format(goal)}`
}
