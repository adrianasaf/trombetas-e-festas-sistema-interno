import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { numberFmt } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Gráficos leves em SVG/HTML (sem biblioteca). Cores da marca: série 1 = azul-céu (presencial),
 * série 2 = azul-halo (online), meta = dourado — ver docs/DECISOES.md (D-048).
 * Textos usam as cores de texto, nunca a cor da série. Toda visualização tem uma tabela equivalente.
 */
export const SERIES = ['var(--series-1)', 'var(--series-2)'] as const

export function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string
  description?: string
  children: ReactNode
  table?: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section className="break-inside-avoid rounded-lg border border-border/70 bg-card p-5" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-xl font-bold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {table && (
          <button
            type="button"
            className="no-print min-h-9 shrink-0 rounded-md border px-2 text-xs font-semibold hover:bg-secondary"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
          >
            {showTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        )}
      </div>
      {showTable ? table : children}
    </section>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export interface BarRow {
  key: string
  label: string
  value: number
  /** Texto à direita (ex.: "82% — 246/300"). Padrão: o valor. */
  valueLabel?: string
  /** Linha extra no tooltip. */
  detail?: string
  href?: string
}

/** Barras horizontais de uma série (magnitude por categoria). */
export function BarList({
  rows,
  max,
  goalAt,
  emptyText = 'Nada para mostrar ainda.',
}: {
  rows: BarRow[]
  max?: number
  /** Valor da meta no eixo (desenha um filete dourado). */
  goalAt?: number
  emptyText?: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>
  return (
    <ul className="space-y-[2px]">
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / top) * 100))
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{r.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {r.valueLabel ?? numberFmt.format(r.value)}
              </span>
            </div>
            <div className="relative mt-1 h-2.5 rounded-r bg-muted">
              <div
                className="h-full rounded-r-[4px] transition-[width]"
                style={{
                  width: `${pct}%`,
                  background: SERIES[0],
                  opacity: hover && hover !== r.key ? 0.55 : 1,
                }}
              />
              {goalAt !== undefined && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -bottom-0.5 w-[2px] bg-[var(--goal)]"
                  style={{ left: `calc(${Math.min(100, (goalAt / top) * 100)}% - 1px)` }}
                />
              )}
            </div>
            {hover === r.key && r.detail && (
              <div role="tooltip" className="mt-1 rounded bg-foreground px-2 py-1 text-xs text-background">
                {r.detail}
              </div>
            )}
          </>
        )
        return (
          <li
            key={r.key}
            className="rounded-md px-1 py-1.5 hover:bg-secondary/60"
            onMouseEnter={() => setHover(r.key)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(r.key)}
            onBlur={() => setHover(null)}
          >
            {r.href ? (
              <Link to={r.href} className="block outline-none">
                {content}
              </Link>
            ) : (
              <div tabIndex={r.detail ? 0 : undefined} className="outline-none">
                {content}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Barra empilhada única com duas partes (ex.: presencial × somente online). */
export function SplitBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div>
      <Legend items={parts.map((p, i) => ({ label: p.label, color: SERIES[i] }))} />
      <div
        className="flex h-8 w-full gap-[2px] overflow-hidden rounded bg-muted"
        role="img"
        aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}
      >
        {total > 0 &&
          parts.map((p, i) =>
            p.value > 0 ? (
              <div
                key={p.label}
                title={`${p.label}: ${numberFmt.format(p.value)}`}
                style={{ width: `${(p.value / total) * 100}%`, background: SERIES[i] }}
              />
            ) : null,
          )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="text-muted-foreground">{p.label}</dt>
            <dd className="text-lg font-bold tabular-nums">
              {numberFmt.format(p.value)}
              {total > 0 && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({Math.round((p.value / total) * 100)}%)
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export interface LinePoint {
  x: string // rótulo do eixo (ex.: "21/11")
  values: number[]
}

/** Linhas (até 2 séries, mesmo eixo) com cruz e tooltip ao passar o mouse/dedo. */
export function LineChart({
  points,
  series,
  height = 200,
}: {
  points: LinePoint[]
  series: string[]
  height?: number
}) {
  const id = useId()
  const [active, setActive] = useState<number | null>(null)
  const width = 640
  const pad = { l: 36, r: 12, t: 10, b: 24 }
  const max = useMemo(() => Math.max(1, ...points.flatMap((p) => p.values)), [points])
  if (points.length === 0) return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
  const xs = (i: number) =>
    pad.l +
    (points.length === 1 ? (width - pad.l - pad.r) / 2 : (i * (width - pad.l - pad.r)) / (points.length - 1))
  const ys = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b)
  const ticks = [0, Math.round(max / 2), max]
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))

  function onMove(clientX: number, rect: DOMRect) {
    const x = ((clientX - rect.left) / rect.width) * width
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(xs(i) - x) < Math.abs(xs(best) - x)) best = i
    setActive(best)
  }

  return (
    <div>
      <Legend items={series.map((s, i) => ({ label: s, color: SERIES[i] }))} />
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-labelledby={`${id}-t`}
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setActive(null)}
        >
          <title id={`${id}-t`}>{series.join(' e ')} por dia</title>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={ys(t)}
                y2={ys(t)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text x={pad.l - 6} y={ys(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
                {numberFmt.format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                key={p.x}
                x={xs(i)}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {p.x}
              </text>
            ) : null,
          )}
          {series.map((_, si) => (
            <polyline
              key={si}
              fill="none"
              stroke={SERIES[si]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.map((p, i) => `${xs(i)},${ys(p.values[si] ?? 0)}`).join(' ')}
            />
          ))}
          {active !== null && (
            <g>
              <line
                x1={xs(active)}
                x2={xs(active)}
                y1={pad.t}
                y2={height - pad.b}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {series.map((_, si) => (
                <circle
                  key={si}
                  cx={xs(active)}
                  cy={ys(points[active].values[si] ?? 0)}
                  r={4.5}
                  fill={SERIES[si]}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
        {active !== null && (
          <div
            role="tooltip"
            className={cn(
              'pointer-events-none absolute top-0 rounded-md border bg-card px-2 py-1 text-xs shadow-md',
              xs(active) > width / 2 ? '-translate-x-full' : '',
            )}
            style={{ left: `${(xs(active) / width) * 100}%` }}
          >
            <div className="font-semibold">{points[active].x}</div>
            {series.map((s, si) => (
              <div key={s} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: SERIES[si] }}
                  aria-hidden
                />
                {s}:{' '}
                <strong className="tabular-nums">{numberFmt.format(points[active].values[si] ?? 0)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Tabela simples usada como alternativa acessível aos gráficos. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="table-pro">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} data-label={head[j]} className={cn(typeof c === 'number' && 'num')}>
                  {typeof c === 'number' ? numberFmt.format(c) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
