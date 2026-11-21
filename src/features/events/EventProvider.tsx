import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type EventStatus = 'planejamento' | 'ativo' | 'encerrado'

export interface EventRow {
  id: string
  name: string
  year: number
  starts_at: string | null
  location: string | null
  stream_url: string | null
  logo_path: string | null
  invites_goal_per_member: number
  attendance_goal_per_member: number
  cutoff_at: string | null
  snapshot_taken_at: string | null
  status: EventStatus
  closed_at: string | null
}

interface EventState {
  events: EventRow[]
  loading: boolean
  /** Edição selecionada no topo (padrão: a ativa). */
  current: EventRow | null
  active: EventRow | null
  setCurrentId: (id: string) => void
  /** true quando a edição selecionada está encerrada. */
  readOnly: boolean
  logoUrl: string | null
}

const EventContext = createContext<EventState | null>(null)
const STORAGE_KEY = 'tef:evento-selecionado'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(
          'id, name, year, starts_at, location, stream_url, logo_path, invites_goal_per_member, attendance_goal_per_member, cutoff_at, snapshot_taken_at, status, closed_at',
        )
        .order('year', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as EventRow[]
    },
    staleTime: 60_000,
  })
  const [selectedId, setSelectedId] = useState<string | null>(readStored)

  const events = useMemo(() => query.data ?? [], [query.data])
  const active = events.find((e) => e.status === 'ativo') ?? null
  const current = events.find((e) => e.id === selectedId) ?? active ?? events[0] ?? null

  useEffect(() => {
    // Se a edição guardada não existe mais, volta para a ativa.
    if (selectedId && events.length && !events.some((e) => e.id === selectedId)) setSelectedId(null)
  }, [events, selectedId])

  const logoUrl = current?.logo_path
    ? supabase.storage.from('logos').getPublicUrl(current.logo_path).data.publicUrl
    : null

  const value: EventState = {
    events,
    loading: query.isLoading,
    current,
    active,
    readOnly: current?.status === 'encerrado',
    logoUrl,
    setCurrentId: (id) => {
      setSelectedId(id)
      try {
        window.localStorage.setItem(STORAGE_KEY, id)
      } catch {
        /* armazenamento indisponível: seleção vale só nesta aba */
      }
    },
  }
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEvent(): EventState {
  const ctx = useContext(EventContext)
  if (!ctx) throw new Error('useEvent precisa estar dentro de <EventProvider>')
  return ctx
}
