/**
 * Banco Postgres local em WebAssembly (PGlite) para testar migrations e RLS sem Docker.
 * Simula o mínimo do Supabase: esquemas auth/storage/realtime, papéis anon/authenticated
 * e auth.uid() lido de request.jwt.claim.sub — o mesmo mecanismo do PostgREST.
 * Os testes contra o banco REAL (via API) ficam em scripts/testar-rls.mjs.
 */
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../migrations')

const SUPABASE_STUB = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists realtime;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}',
  last_sign_in_at timestamptz,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create table realtime.messages_stub (topic text, event text, payload jsonb, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$
  insert into realtime.messages_stub values (topic, event, payload, private)
$$;
create publication supabase_realtime;
grant usage on schema auth, extensions, public, storage, realtime to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`

export interface TestDb {
  db: PGlite
  /** Executa como usuário autenticado (RLS ativo). */
  as<T = Record<string, unknown>>(userId: string | null, sql: string, params?: unknown[]): Promise<T[]>
  /** Executa como dono do banco (sem RLS). */
  admin<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  createUser(email: string, fullName?: string): Promise<string>
  close(): Promise<void>
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite({ extensions: { pg_trgm, pgcrypto } })
  await db.exec(SUPABASE_STUB)
  for (const file of migrationFiles()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Falha na migration ${file}: ${(error as Error).message}`)
    }
  }

  // Executa uma consulta por vez para que o papel nunca vaze entre chamadas.
  let chain: Promise<unknown> = Promise.resolve()
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(fn, fn)
    chain = next.catch(() => undefined)
    return next
  }

  return {
    db,
    as: (userId, sql, params = []) =>
      serial(async () =>
        db.transaction(async (tx) => {
          await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
          await tx.exec(userId ? 'set local role authenticated' : 'set local role anon')
          const res = await tx.query(sql, params)
          return res.rows as never
        }),
      ),
    admin: (sql, params = []) =>
      serial(async () => {
        const res = await db.query(sql, params)
        return res.rows as never
      }),
    createUser: (email, fullName = '') =>
      serial(async () => {
        const res = await db.query<{ id: string }>(
          `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
          [email, fullName],
        )
        return res.rows[0].id
      }),
    close: () => db.close(),
  }
}
