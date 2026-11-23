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

describe('generateTempPassword', async () => {
  const { generateTempPassword, validateNewPassword } = await import('./password')
  it('gera senhas válidas, sem caracteres ambíguos e diferentes entre si', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword()
      expect(p).toHaveLength(10)
      expect(validateNewPassword(p, p)).toBeNull()
      expect(p).not.toMatch(/[0O1lI]/)
      seen.add(p)
    }
    expect(seen.size).toBe(200)
  })
})
