import { describe, expect, it } from 'vitest'
import { formatPhone, maskPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['(83) 98765-4321', '+5583987654321'],
    ['83987654321', '+5583987654321'],
    ['+55 83 98765-4321', '+5583987654321'],
    ['5583987654321', '+5583987654321'],
    ['083 98765-4321', '+5583987654321'],
    ['98765-4321', '+5583987654321'],
    ['3214-5678', '+558332145678'],
    ['(11) 3214-5678', '+551132145678'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(['', '123', 'abc', '(83) 88765-4321', '(01) 98765-4321', '839876543210000'])(
    'rejeita "%s"',
    (input) => {
      expect(normalizePhone(input)).toBeNull()
    },
  )
})

describe('formatação', () => {
  it('formata celular e fixo', () => {
    expect(formatPhone('+5583987654321')).toBe('(83) 98765-4321')
    expect(formatPhone('+558332145678')).toBe('(83) 3214-5678')
  })
  it('mascara conforme especificação', () => {
    expect(maskPhone('+5583987651234')).toBe('(83) 9****-1234')
    expect(maskPhone('+558332145678')).toBe('(83) ****-5678')
    expect(maskPhone(null)).toBe('')
  })
})
