/**
 * CSV para o Excel em português: UTF-8 com BOM, separador ";" e quebra CRLF.
 * Campos que começam com = + - @ ganham um apóstrofo (proteção contra injeção de fórmula).
 */
export const CSV_BOM = '﻿'

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[";\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(head: string[], rows: unknown[][]): string {
  const lines = [head, ...rows].map((r) => r.map(csvCell).join(';'))
  return CSV_BOM + lines.join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, head: string[], rows: unknown[][]) {
  const blob = new Blob([toCsv(head, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nome de arquivo seguro: "convidados-icm-torre-2026-11-21.csv". */
export function csvFilename(...parts: (string | null | undefined)[]): string {
  const slug = parts
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug}.csv`
}
