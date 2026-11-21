-- =====================================================================
-- Fase 2 — Funções auxiliares de escopo saem do schema exposto pela API.
-- O schema `private` não está em [api].schemas, então essas funções não aparecem
-- em /rest/v1/rpc. As políticas RLS continuam funcionando (referenciam por OID).
-- Permanecem em public apenas RPCs intencionais: can_grant_role (Edge Function)
-- e list_manageable_users (tela de usuários).
-- =====================================================================
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.has_any_role() set schema private;
alter function public.has_role(public.app_role) set schema private;
alter function public.is_polo_admin() set schema private;
alter function public.my_managed_church_ids() set schema private;
alter function public.my_led_group_ids() set schema private;
alter function public.my_stats_church_ids() set schema private;
alter function public.can_view_polo_stats() set schema private;
alter function public.has_church_access(uuid) set schema private;
alter function public.has_group_access(uuid) set schema private;
alter function public.has_record_access(uuid, uuid) set schema private;
alter function public.can_check_in() set schema private;
alter function public.event_is_open(uuid) set schema private;
alter function public.active_event_id() set schema private;
alter function public.can_manage_user(uuid) set schema private;
alter function public.current_profile_id() set schema private;

-- As funções movidas chamam umas às outras com o prefixo public.*; recriamos os corpos
-- que fazem referência cruzada para apontar para private.*.
create or replace function private.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.role_assignments ra join public.profiles p on p.id = ra.user_id
    where ra.user_id = auth.uid() and p.active and ra.role = p_role
  );
$$;

create or replace function private.is_polo_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('polo_admin');
$$;

create or replace function private.my_managed_church_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select case
    when private.is_polo_admin() then (select coalesce(array_agg(id), '{}') from public.churches)
    else (
      select coalesce(array_agg(distinct ra.church_id), '{}')
      from public.role_assignments ra join public.profiles p on p.id = ra.user_id
      where ra.user_id = auth.uid() and p.active and ra.role = 'church_manager'
    )
  end;
$$;

create or replace function private.my_stats_church_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select case
    when private.can_view_polo_stats() then (select coalesce(array_agg(id), '{}') from public.churches)
    else (
      select coalesce(array_agg(distinct x.church_id), '{}') from (
        select ra.church_id from public.role_assignments ra join public.profiles p on p.id = ra.user_id
        where ra.user_id = auth.uid() and p.active and ra.role in ('church_manager', 'reader')
          and ra.church_id is not null
        union
        select g.church_id from public.role_assignments ra
        join public.profiles p on p.id = ra.user_id
        join public.assistance_groups g on g.id = ra.group_id
        where ra.user_id = auth.uid() and p.active and ra.role = 'group_leader'
      ) x
    )
  end;
$$;

create or replace function private.can_view_polo_stats()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_polo_admin() or private.has_role('reception') or exists (
    select 1 from public.role_assignments ra join public.profiles p on p.id = ra.user_id
    where ra.user_id = auth.uid() and p.active and ra.role = 'reader' and ra.church_id is null
  );
$$;

create or replace function private.has_church_access(p_church_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_church_id is not null and p_church_id = any (private.my_managed_church_ids());
$$;

create or replace function private.has_group_access(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_group_id is not null and (
    p_group_id = any (private.my_led_group_ids())
    or exists (
      select 1 from public.assistance_groups g
      where g.id = p_group_id and g.church_id = any (private.my_managed_church_ids())
    )
  );
$$;

create or replace function private.has_record_access(p_church_id uuid, p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_church_access(p_church_id)
    or (p_group_id is not null and p_group_id = any (private.my_led_group_ids()));
$$;

create or replace function private.can_check_in()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_polo_admin() or private.has_role('reception') or private.has_role('church_manager');
$$;

create or replace function private.can_manage_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_polo_admin() or (
    private.has_role('church_manager')
    and not exists (
      select 1 from public.role_assignments ra
      where ra.user_id = p_user_id and ra.role in ('polo_admin', 'reception')
    )
    and exists (
      select 1 from public.role_assignments ra
      left join public.assistance_groups g on g.id = ra.group_id
      where ra.user_id = p_user_id
        and coalesce(ra.church_id, g.church_id) = any (private.my_managed_church_ids())
    )
  );
$$;

-- Funções que continuam em public, agora apontando para private.*
create or replace function public.can_grant_role(p_role public.app_role, p_church_id uuid, p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_polo_admin() or (
    p_role in ('church_manager', 'group_leader', 'reader')
    and (
      (p_role in ('church_manager', 'reader') and p_church_id is not null
        and private.has_church_access(p_church_id))
      or (p_role = 'group_leader' and exists (
        select 1 from public.assistance_groups g
        where g.id = p_group_id and private.has_church_access(g.church_id)
          and (p_church_id is null or p_church_id = g.church_id)
      ))
    )
  );
$$;

create or replace function public.list_manageable_users()
returns table (
  id uuid, full_name text, email text, active boolean, last_sign_in_at timestamptz, invited_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email, p.active, u.last_sign_in_at, u.invited_at
  from public.profiles p join auth.users u on u.id = p.id
  where private.can_manage_user(p.id)
  order by p.full_name, p.email;
$$;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (new.active is distinct from old.active or new.email is distinct from old.email)
     and not private.is_polo_admin() then
    raise exception 'Apenas o Administrador do Polo pode alterar a situação do usuário.'
      using errcode = '42501';
  end if;
  if new.id = auth.uid() and new.active is distinct from old.active then
    raise exception 'Você não pode desativar o próprio usuário.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.write_audit(
  p_action text, p_table text, p_record_id text, p_church_id uuid, p_old jsonb, p_new jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (user_id, action, table_name, record_id, church_id, old_data, new_data, ip)
  values (private.current_profile_id(), p_action, p_table, p_record_id, p_church_id, p_old, p_new, public.request_ip());
end;
$$;

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_church uuid;
  v_action text;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;
  v_church := nullif(v_row ->> 'church_id', '')::uuid;
  if v_church is null and v_row ? 'guest_id' then
    select church_id into v_church from public.guests where id = (v_row ->> 'guest_id')::uuid;
  end if;
  if v_church is null and v_row ? 'group_id' and v_row ->> 'group_id' is not null then
    select church_id into v_church from public.assistance_groups where id = (v_row ->> 'group_id')::uuid;
  end if;
  v_action := tg_table_name || '.' || lower(tg_op);
  if tg_table_name = 'attendances' and tg_op = 'UPDATE'
     and (v_old ->> 'revoked_at') is null and (v_new ->> 'revoked_at') is not null then
    v_action := 'attendances.desmarcar';
  elsif tg_table_name = 'attendances' and tg_op = 'INSERT' then
    v_action := 'attendances.marcar';
  end if;
  insert into public.audit_logs (user_id, action, table_name, record_id, church_id, old_data, new_data, ip)
  values (private.current_profile_id(), v_action, tg_table_name, v_row ->> 'id', v_church, v_old, v_new,
          public.request_ip());
  return null;
end;
$$;

-- Permissões no novo schema
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function public.can_grant_role(public.app_role, uuid, uuid) from public, anon;
grant execute on function public.can_grant_role(public.app_role, uuid, uuid) to authenticated;
revoke execute on function public.list_manageable_users() from public, anon;
grant execute on function public.list_manageable_users() to authenticated;
revoke execute on function public.request_ip() from public, anon;
revoke execute on function public.normalize_name(text) from anon;
revoke execute on function public.normalize_phone(text, text) from anon;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_delete() from public, anon, authenticated;
revoke execute on function public.guard_group_church_change() from public, anon, authenticated;
revoke execute on function public.events_before_update() from public, anon, authenticated;
