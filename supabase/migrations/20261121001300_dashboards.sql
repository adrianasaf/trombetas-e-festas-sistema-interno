-- =====================================================================
-- Fase 7 — Agregados para dashboards (seção 13). Sem dados pessoais; escopo por perfil.
-- =====================================================================

-- Evolução diária (dia no fuso America/Fortaleza): convites cadastrados e presenças presenciais.
create or replace function public.stats_daily(p_event_id uuid default null, p_church_id uuid default null,
  p_group_id uuid default null)
returns table (day date, invites bigint, attendances bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event uuid := coalesce(p_event_id, private.active_event_id());
begin
  if v_event is null or not private.can_view_stats(p_church_id, p_group_id) then
    return;
  end if;
  return query
  with f as (
    select * from private.guest_facts(v_event) x
    where (p_church_id is null or x.church_id = p_church_id) and (p_group_id is null or x.group_id = p_group_id)
  ),
  inv as (
    select (created_at at time zone 'America/Fortaleza')::date d, count(*) n from f group by 1
  ),
  att as (
    select (presencial_at at time zone 'America/Fortaleza')::date d, count(*) n from f
    where has_presencial group by 1
  )
  select coalesce(inv.d, att.d), coalesce(inv.n, 0), coalesce(att.n, 0)
  from inv full join att on att.d = inv.d
  order by 1;
end;
$$;

-- Convidados por categoria (com presentes) e por modalidade.
create or replace function public.stats_categories(p_event_id uuid default null, p_church_id uuid default null,
  p_group_id uuid default null)
returns table (category public.guest_category, guests bigint, present bigint, online bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event uuid := coalesce(p_event_id, private.active_event_id());
begin
  if v_event is null or not private.can_view_stats(p_church_id, p_group_id) then
    return;
  end if;
  return query
  select f.category, count(*), count(*) filter (where f.has_presencial),
    count(*) filter (where f.has_online and not f.has_presencial)
  from private.guest_facts(v_event) f
  where (p_church_id is null or f.church_id = p_church_id) and (p_group_id is null or f.group_id = p_group_id)
  group by f.category
  order by f.category;
end;
$$;

-- Situação do transporte (solicitações não canceladas de convidados não mesclados).
create or replace function public.stats_transport(p_event_id uuid default null, p_church_id uuid default null,
  p_group_id uuid default null)
returns table (status public.transport_status, total bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event uuid := coalesce(p_event_id, private.active_event_id());
begin
  if v_event is null or not private.can_view_stats(p_church_id, p_group_id) then
    return;
  end if;
  return query
  select t.status, count(*)
  from public.transport_requests t
  join public.guests g on g.id = t.guest_id
  where t.event_id = v_event and t.cancelled_at is null and g.merged_into_id is null
    and (p_church_id is null or g.church_id = p_church_id) and (p_group_id is null or g.group_id = p_group_id)
  group by t.status;
end;
$$;

revoke execute on function public.stats_daily(uuid, uuid, uuid) from public, anon;
revoke execute on function public.stats_categories(uuid, uuid, uuid) from public, anon;
revoke execute on function public.stats_transport(uuid, uuid, uuid) from public, anon;
grant execute on function public.stats_daily(uuid, uuid, uuid), public.stats_categories(uuid, uuid, uuid),
  public.stats_transport(uuid, uuid, uuid) to authenticated;
