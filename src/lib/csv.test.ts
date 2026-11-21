import { describe, expect, it } from 'vitest'
import { CSV_BOM, csvCell, csvFilename, toCsv } from './csv'

describe('CSV', () => {
  it('começa com BOM e usa ; e CRLF', () => {
    const out = toCsv(['Nome', 'Igreja'], [['João', 'ICM Torre']])
    expect(out.startsWith(CSV_BOM)).toBe(true)
    expect(out).toBe(`${CSV_BOM}Nome;Igreja\r\nJoão;ICM Torre\r\n`)
  })
  it('escapa aspas, ponto e vírgula e quebras de linha', () => {
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })
  it('neutraliza fórmulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+5583987654321')).toBe("'+5583987654321")
    expect(csvCell('-1')).toBe("'-1")
  })
  it('booleanos e nulos', () => {
    expect(csvCell(true)).toBe('Sim')
    expect(csvCell(null)).toBe('')
  })
  it('gera nome de arquivo sem acentos', () => {
    expect(csvFilename('Convidados', 'ICM Cruz do Espírito Santo', '2026-11-21')).toBe(
      'convidados-icm-cruz-do-espirito-santo-2026-11-21.csv',
    )
  })
})
