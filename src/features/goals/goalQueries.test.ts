import { describe, expect, it } from 'vitest'
import { toNumbers } from './goalQueries'

describe('toNumbers', () => {
  it('converte bigint/numeric em texto para número e preserva o resto', () => {
    expect(toNumbers({ a: '60', b: '81.6', c: null, d: 'ICM Torre', e: true, group_name: '2026' })).toEqual({
      a: 60,
      b: 81.6,
      c: null,
      d: 'ICM Torre',
      e: true,
      group_name: '2026',
    })
  })
})
