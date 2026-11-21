-- Revisão de segurança automatizada (somente leitura). Cada linha devolvida é um PROBLEMA.
-- Uso: npx supabase db query --remote --yes -f scripts/sql/revisao-seguranca.sql
select 'tabela sem RLS' as problema, c.relname as objeto
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'anon com privilégio em tabela', table_name::text
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
union all
select 'função SECURITY DEFINER sem search_path fixo', n.nspname || '.' || p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private') and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
union all
select 'anon pode executar função SECURITY DEFINER', n.nspname || '.' || p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private') and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
union all
select 'função interna exposta a usuários', 'public.' || p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('bootstrap_polo_admin', 'find_user_id_by_email', 'write_audit')
  and has_function_privilege('authenticated', p.oid, 'execute')
union all
select 'schema private exposto ao anon', 'private'
where has_schema_privilege('anon', 'private', 'usage')
union all
select 'bucket público inesperado', id from storage.buckets where public and id <> 'logos';
