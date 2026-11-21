import { describe, expect, it } from 'vitest'
import { translateError } from './errors'

describe('translateError', () => {
  it('traduz erros de login', () => {
    expect(translateError({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
  })
  it('traduz RLS para mensagem de permissão', () => {
    expect(translateError({ message: 'new row violates row-level security policy', code: '42501' })).toBe(
      'Você não tem permissão para esta operação.',
    )
  })
  it('mantém mensagens de regra de negócio do banco', () => {
    expect(translateError({ message: 'O grupo de assistência está inativo.', code: '23514' })).toBe(
      'O grupo de assistência está inativo.',
    )
  })
  it('tem mensagem padrão', () => {
    expect(translateError(null)).toMatch(/Não foi possível/)
  })
})
