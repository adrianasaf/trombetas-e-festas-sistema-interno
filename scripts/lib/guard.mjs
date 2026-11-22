import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Projetos Supabase de PRODUÇÃO: scripts de teste, seed e limpeza nunca rodam neles. */
export const PRODUCTION_REFS = ['zaawhfbmuogfyigxscta']

const root = path.resolve(import.meta.dirname, '../..')

export function linkedRef() {
  const file = path.join(root, 'supabase/.temp/project-ref')
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
}

/** Encerra o processo se o projeto vinculado for de produção. */
export function refuseProduction(scriptName) {
  const ref = linkedRef()
  if (!ref || PRODUCTION_REFS.includes(ref)) {
    console.error(
      `${scriptName}: recusado. O projeto vinculado (${ref || 'nenhum'}) é PRODUÇÃO ou não foi identificado. ` +
        'Scripts de teste, seed e limpeza só rodam num projeto DEV separado.',
    )
    process.exit(1)
  }
}
