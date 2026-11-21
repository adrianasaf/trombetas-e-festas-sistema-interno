import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, canAccess, navForRoles } from './roles'

describe('menu por perfil', () => {
  it('admin vê os 12 itens', () => {
    expect(navForRoles(['polo_admin'])).toHaveLength(12)
    expect(NAV_ITEMS).toHaveLength(12)
  })
  it('recepção vê apenas dashboard e check-in', () => {
    expect(navForRoles(['reception']).map((i) => i.to)).toEqual(['/', '/check-in'])
  })
  it('leitor não acessa convidados nem check-in', () => {
    expect(canAccess('/convidados', ['reader'])).toBe(false)
    expect(canAccess('/check-in', ['reader'])).toBe(false)
    expect(canAccess('/relatorios', ['reader'])).toBe(true)
  })
  it('escopo é a união das atribuições', () => {
    const paths = navForRoles(['reception', 'group_leader']).map((i) => i.to)
    expect(paths).toContain('/check-in')
    expect(paths).toContain('/membros')
    expect(paths).not.toContain('/configuracoes')
  })
})
