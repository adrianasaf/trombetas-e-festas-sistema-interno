import { useEffect, useState } from 'react'
import type { EventRow } from '@/features/events/EventProvider'
import { formatDateTime } from '@/lib/format'

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

/** Faixa de destaque do Dashboard: edição, data, local e contagem regressiva. */
export function EventHero({ event }: { event: EventRow }) {
  const now = useNow()
  const start = event.starts_at ? new Date(event.starts_at).getTime() : null
  const diff = start ? start - now : null
  const days = diff !== null ? Math.floor(diff / 86_400_000) : null
  const hours = diff !== null ? Math.floor((diff % 86_400_000) / 3_600_000) : null

  let status: string
  if (event.status === 'encerrado') status = 'Edição encerrada'
  else if (diff === null) status = 'Data do evento ainda não definida'
  else if (diff <= 0 && diff > -6 * 3_600_000) status = 'O evento está acontecendo agora'
  else if (diff <= 0) status = 'Evento realizado'
  else status = 'Contagem regressiva'

  return (
    <section className="relative mb-8 overflow-hidden rounded-lg bg-navy text-white">
      <img
        src="/brand/trombetas-2026.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto max-w-[62%] object-cover object-[2%_center] md:block"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, #000 35%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 35%)',
        }}
      />
      <div className="relative flex flex-col gap-6 p-6 md:max-w-[58%] md:p-8">
        <div>
          <p className="text-[0.7rem] font-semibold tracking-[0.28em] text-gold-bright uppercase">{status}</p>
          <h2 className="mt-2 text-[2rem] text-white">{event.name}</h2>
          <p className="mt-1 text-white/85">
            {event.starts_at ? formatDateTime(event.starts_at) : 'Defina a data em Configurações'}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        </div>
        {diff !== null && diff > 0 && event.status !== 'encerrado' && (
          <div className="flex gap-8" aria-live="off">
            <Unit value={days!} label={days === 1 ? 'dia' : 'dias'} />
            <Unit value={hours!} label={hours === 1 ? 'hora' : 'horas'} />
          </div>
        )}
      </div>
    </section>
  )
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-20">
      <div className="num text-[2.5rem] leading-none font-semibold text-gold-bright">{value}</div>
      <div className="mt-1 text-[0.7rem] tracking-[0.24em] text-white/80 uppercase">{label}</div>
    </div>
  )
}
