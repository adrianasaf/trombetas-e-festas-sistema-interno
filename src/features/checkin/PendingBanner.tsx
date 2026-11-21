import { CloudOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkinQueue, usePendingCheckins } from './checkinApi'

/** Contador "X check-ins aguardando envio" (seção 11). */
export function PendingBanner() {
  const pending = usePendingCheckins()
  if (!pending.length) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-warning bg-warning/10 p-3 text-warning"
    >
      <CloudOff className="size-6 shrink-0" aria-hidden />
      <span className="font-bold">
        {pending.length} check-in{pending.length > 1 ? 's' : ''} aguardando envio
      </span>
      <span className="text-sm">Serão enviados automaticamente quando a internet voltar.</span>
      <Button size="sm" variant="outline" className="ml-auto" onClick={() => void checkinQueue.flush()}>
        <RefreshCw /> Tentar agora
      </Button>
    </div>
  )
}
