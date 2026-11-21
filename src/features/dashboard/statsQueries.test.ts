import { describe, expect, it } from 'vitest'
import { fillDays, shortDay } from './statsQueries'

describe('séries diárias', () => {
  it('formata dia curto', () => {
    expect(shortDay('2026-11-21')).toBe('21/11')
  })
  it('preenche dias sem movimento', () => {
    const rows = fillDays(
      [
        { day: '2026-11-28', invites: 2 },
        { day: '2026-12-01', invites: 5 },
      ],
      (day) => ({ day, invites: 0 }),
    )
    expect(rows.map((r) => r.day)).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'])
    expect(rows[1].invites).toBe(0)
  })
})
