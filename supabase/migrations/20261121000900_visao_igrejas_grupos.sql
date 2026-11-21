-- =====================================================================
-- Fase 3 — Visões agregadas de igrejas e grupos (sem dados pessoais).
-- Respeitam o escopo de estatística do usuário (private.my_stats_church_ids).
-- =====================================================================

create or replace function public.church_overview()
returns table (
  id uuid, name text, city text, address text, active boolean,
  groups_total bigint, groups_active bigint, members_active bigint, members_total bigint
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.city, c.address, c.active,
    (select count(*) from public.assistance_groups g where g.church_id = c.id),
    (select count(*) from public.assistance_groups g where g.church_id = c.id and g.active),
    (select count(*) from public.members m where m.church_id = c.id and m.active),
    (select count(*) from public.members m where m.church_id = c.id)
  from public.churches c
  where c.id = any (private.my_stats_church_ids())
  order by c.name;
$$;

create or replace function public.group_overview(p_church_id uuid default null)
returns table (
  id uuid, church_id uuid, church_name text, name text, leader_name text, leader_user_id uuid,
  assistant_leader_name text, active boolean, members_active bigint, members_total bigint
)
language sql stable security definer
set search_path = ''
as $$
  select g.id, g.church_id, c.name, g.name, g.leader_name, g.leader_user_id, g.assistant_leader_name, g.active,
    (select count(*) from public.members m where m.group_id = g.id and m.active),
    (select count(*) from public.members m where m.group_id = g.id)
  from public.assistance_groups g
  join public.churches c on c.id = g.church_id
  where (p_church_id is null or g.church_id = p_church_id)
    and (
      g.church_id = any (private.my_stats_church_ids())
      or g.id = any (private.my_led_group_ids())
    )
  order by c.name, g.name;
$$;

revoke execute on function public.church_overview() from public, anon;
revoke execute on function public.group_overview(uuid) from public, anon;
grant execute on function public.church_overview() to authenticated;
grant execute on function public.group_overview(uuid) to authenticated;
