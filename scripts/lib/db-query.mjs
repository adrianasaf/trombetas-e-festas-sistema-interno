import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/**
 * Executa SQL no projeto vinculado via `supabase db query --remote --file`.
 * O SQL vai num arquivo temporário (removido em seguida) para não depender de aspas no shell.
 */
export function runRemoteSql(sql, { capture = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tef-sql-'))
  const file = path.join(dir, 'query.sql')
  writeFileSync(file, sql, 'utf8')
  try {
    return spawnSync('npx', ['supabase', 'db', 'query', '--remote', '--yes', '--file', file], {
      stdio: capture ? 'pipe' : 'inherit',
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 20 * 1024 * 1024,
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
