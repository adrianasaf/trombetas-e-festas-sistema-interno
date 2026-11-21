import { describe, expect, it } from 'vitest'
import { validateNewPassword } from './password'

describe('validateNewPassword', () => {
  it('exige 8 caracteres', () => {
    expect(validateNewPassword('abc123', 'abc123')).toMatch(/8 caracteres/)
  })
  it('exige letras e números', () => {
    expect(validateNewPassword('abcdefgh', 'abcdefgh')).toMatch(/letras e números/)
    expect(validateNewPassword('12345678', '12345678')).toMatch(/letras e números/)
  })
  it('exige confirmação igual', () => {
    expect(validateNewPassword('trombeta2026', 'trombeta2025')).toMatch(/não conferem/)
  })
  it('aceita senha válida', () => {
    expect(validateNewPassword('trombeta2026', 'trombeta2026')).toBeNull()
  })
})
