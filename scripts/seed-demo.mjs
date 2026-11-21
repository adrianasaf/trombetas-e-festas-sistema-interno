#!/usr/bin/env node
/**
 * Aplica (ou remove) o seed de demonstração no projeto DEV.
 *   npm run seed:demo          → aplica
 *   npm run seed:demo -- --limpar → remove
 * Recusa-se a rodar se o projeto vinculado não for o DEV oficial.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { runRemoteSql } from './lib/db-query.mjs'

const DEV_REF = 'zaawhfbmuogfyigxscta'
const root = path.resolve(import.meta.dirname, '..')
const refFile = path.join(root, 'supabase/.temp/project-ref')
const ref = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : ''
if (ref !== DEV_REF) {
  console.error(`Projeto vinculado (${ref || 'nenhum'}) não é o DEV (${DEV_REF}). Seed NÃO aplicado.`)
  process.exit(1)
}
const limpar = process.argv.includes('--limpar')
const file = path.join(root, 'scripts/sql', limpar ? 'limpar-demo.sql' : 'seed-demo.sql')
const t0 = Date.now()
const r = runRemoteSql(readFileSync(file, 'utf8'), { capture: true })
if (r.status !== 0) {
  console.error((r.stdout || '').slice(-2000), (r.stderr || '').slice(-500))
  process.exit(1)
}
console.log(
  `${limpar ? 'Demonstração removida' : 'Seed de demonstração aplicado'} em ${((Date.now() - t0) / 1000).toFixed(1)} s.`,
)
