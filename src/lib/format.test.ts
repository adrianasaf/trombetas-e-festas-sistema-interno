import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatPercent, formatTime } from './format'

describe('formatação de datas no fuso America/Fortaleza', () => {
  it('converte UTC para UTC−3', () => {
    expect(formatTime('2026-12-05T22:42:00Z')).toBe('19:42')
    expect(formatDateTime('2026-12-06T01:30:00Z')).toBe('05/12/2026, 22:30')
  })
  it('não desloca datas sem horário', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })
  it('formata percentuais', () => {
    expect(formatPercent(81.6)).toBe('82%')
    expect(formatPercent(null)).toBe('—')
  })
})
