export const TIME_ZONE = 'America/Fortaleza'

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
})
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: TIME_ZONE })
const timeOnly = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE })

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : ''
}

export function formatTime(value: string | null | undefined): string {
  return value ? timeOnly.format(new Date(value)) : ''
}

/** Datas "YYYY-MM-DD" (colunas date) — sem conversão de fuso. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return dateOnly.format(new Date(value))
}

/** Hoje no fuso do evento, como "YYYY-MM-DD". */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${Math.round(value)}%`
}

export const numberFmt = new Intl.NumberFormat('pt-BR')
