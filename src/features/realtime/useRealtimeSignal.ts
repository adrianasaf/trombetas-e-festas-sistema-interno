import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const DEBOUNCE_MS = 2000
/** Consultas recarregadas quando chega o sinal "algo mudou". */
const KEYS = [
  'stats',
  'checkin-search',
  'guests',
  'guest',
  'transport',
  'members',
  'church-overview',
  'group-overview',
]

export type RealtimeStatus = 'conectando' | 'conectado' | 'desconectado'

/**
 * Escuta o canal de Broadcast "tef-sinal". O banco envia apenas um aviso sem dados pessoais;
 * ao recebê-lo, recarregamos os agregados via RPC com debounce de 2 s (seção 12).
 */
export function useRealtimeSignal(enabled = true): RealtimeStatus {
  const qc = useQueryClient()
  const timer = useRef<number | null>(null)
  const [status, setStatus] = useState<RealtimeStatus>('conectando')

  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('tef-sinal')
      .on('broadcast', { event: 'mudou' }, () => {
        if (timer.current) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          for (const key of KEYS) void qc.invalidateQueries({ queryKey: [key] })
        }, DEBOUNCE_MS)
      })
      .subscribe((s) => {
        // Ao (re)conectar, recarrega: sinais enviados enquanto estava desconectado se perderam.
        if (s === 'SUBSCRIBED') for (const key of KEYS) void qc.invalidateQueries({ queryKey: [key] })
        setStatus(
          s === 'SUBSCRIBED'
            ? 'conectado'
            : s === 'CLOSED' || s === 'CHANNEL_ERROR'
              ? 'desconectado'
              : 'conectando',
        )
      })
    // Rede de segurança: agregados recarregam a cada 60 s mesmo sem sinal.
    const safety = window.setInterval(() => void qc.invalidateQueries({ queryKey: ['stats'] }), 60_000)
    return () => {
      window.clearInterval(safety)
      if (timer.current) window.clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
  }, [enabled, qc])

  return status
}
