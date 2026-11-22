#!/usr/bin/env node
/**
 * Teste de carga simples (seção 19, item 14): busca do check-in < 1 s com ~3.000 convidados.
 * Mede o tempo de ponta a ponta (rede + banco) de buscas reais pela API, como a Recepção,
 * incluindo 20 buscas simultâneas (várias recepções ao mesmo tempo).
 *   npm run test:carga
 */
import { loadEnv, loginAs, prepareTestUsers } from './lib/test-users.mjs'

import { refuseProduction } from './lib/guard.mjs'

refuseProduction('test:carga')

const env = loadEnv()
const password = prepareTestUsers()
const recepcao = await loginAs(env, 'rls.recepcao', password)

const { count } = await (
  await loginAs(env, 'rls.admin', password)
)
  .from('guests')
  .select('id', { count: 'exact', head: true })
console.log(`Convidados na base DEV: ${count}`)

const TERMS = [
  'maria',
  'jose silva',
  'ana',
  'souza',
  'francisca',
  'pedro lima',
  'cavalcanti',
  'oliveira',
  'antonia',
  'lucas',
  '1234',
  '5678',
  '83 9',
  'beatriz rocha',
  'joao',
  'mar',
  'santos',
  'medeiros',
  'amanda',
  '0000',
  'carlos',
  'raquel dias',
  'gabriel',
  'fernanda',
  'teixeira',
]

async function timed(term) {
  const t0 = performance.now()
  const { data, error } = await recepcao.rpc('search_checkin', { p_query: term, p_limit: 20 })
  const ms = performance.now() - t0
  if (error) throw new Error(`${term}: ${error.message}`)
  return { term, ms, n: data.length }
}

const pct = (arr, p) =>
  arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))]

// Aquecimento (primeira conexão)
await timed('maria')

const seq = []
for (const t of TERMS) seq.push(await timed(t))
const seqMs = seq.map((r) => r.ms)
console.log(
  `\nSequencial (${seq.length} buscas): p50 ${pct(seqMs, 50).toFixed(0)} ms · p95 ${pct(seqMs, 95).toFixed(0)} ms · máx ${Math.max(...seqMs).toFixed(0)} ms`,
)

const conc = await Promise.all(TERMS.slice(0, 20).map(timed))
const concMs = conc.map((r) => r.ms)
console.log(
  `Simultâneo (20 buscas ao mesmo tempo): p50 ${pct(concMs, 50).toFixed(0)} ms · p95 ${pct(concMs, 95).toFixed(0)} ms · máx ${Math.max(...concMs).toFixed(0)} ms`,
)

const worst = seq.sort((a, b) => b.ms - a.ms).slice(0, 3)
console.log(
  `Mais lentas: ${worst.map((w) => `"${w.term}" ${w.ms.toFixed(0)} ms (${w.n} resultados)`).join(' · ')}`,
)

const ok = pct(seqMs, 95) < 1000 && pct(concMs, 95) < 1000
console.log(ok ? '\n✓ Busca abaixo de 1 s (p95).' : '\n✗ Busca acima de 1 s (p95).')
process.exit(ok ? 0 : 1)
