import { describe, expect, it } from 'vitest'
import { EMPTY_GUEST, validateGuest } from './guestFormModel'

const base = { ...EMPTY_GUEST, fullName: 'João da Silva', category: 'homem' as const, phone: '83987654321' }

describe('validateGuest', () => {
  it('aceita adulto completo com consentimento', () => {
    expect(validateGuest({ ...base, consent: true }, { requireConsent: true })).toBeNull()
  })
  it('exige consentimento no cadastro, mas não na edição', () => {
    expect(validateGuest(base, { requireConsent: true })).toMatch(/consentimento do convidado/)
    expect(validateGuest(base, { requireConsent: false })).toBeNull()
  })
  it('exige telefone de adulto', () => {
    expect(validateGuest({ ...base, phone: '', consent: true }, { requireConsent: true })).toMatch(
      /obrigatório/,
    )
  })
  it('criança: telefone opcional, responsável obrigatório', () => {
    const child = { ...base, category: 'crianca' as const, phone: '', consent: true }
    expect(validateGuest(child, { requireConsent: true })).toMatch(/responsável legal/)
    expect(
      validateGuest(
        { ...child, guardianName: 'Ana Lima', guardianPhone: '83987654000' },
        { requireConsent: true },
      ),
    ).toBeNull()
  })
  it('consentimento de menor é do responsável', () => {
    const child = {
      ...base,
      category: 'adolescente' as const,
      guardianName: 'Ana Lima',
      guardianPhone: '83987654000',
    }
    expect(validateGuest(child, { requireConsent: true })).toMatch(/responsável legal/)
  })
  it('limita observações a 500 caracteres', () => {
    expect(
      validateGuest({ ...base, consent: true, notes: 'x'.repeat(501) }, { requireConsent: true }),
    ).toMatch(/500/)
  })
})
