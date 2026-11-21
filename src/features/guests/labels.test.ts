import { describe, expect, it } from 'vitest'
import { inviteStatusLabel, isMinor } from './labels'

describe('regras de rótulo de convidado', () => {
  it('confirmou + online vira participação online', () => {
    expect(inviteStatusLabel('confirmou', 'online')).toBe('Confirmou participação online')
    expect(inviteStatusLabel('confirmou', 'presencial')).toBe('Confirmou presença')
  })
  it('identifica menores', () => {
    expect(isMinor('crianca')).toBe(true)
    expect(isMinor('adolescente')).toBe(true)
    expect(isMinor('jovem_feminino')).toBe(false)
  })
})
