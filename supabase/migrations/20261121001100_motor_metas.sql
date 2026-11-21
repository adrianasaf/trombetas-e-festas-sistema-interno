-- =====================================================================
-- Fase 5 — Motor de metas e snapshots (seção 10). Cálculos no banco, nunca no frontend.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Base da meta: membros que contam para a meta do evento.
-- Antes do snapshot: membros ativos ao vivo (grupo/igreja atuais).
-- Depois do snapshot: membros ativos NA DATA DE CORTE (grupo/igreja do snapshot).
-- ---------------------------------------------------------------------
create or replace function private.goal_base(p_event_id uuid)
returns table (member_id uuid, group_id uuid, church_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select s.member_id, s.group_id, s.church_id
  from public.goal_snapshots s
  join public.events e on e.id = s.event_id
  where s.event_id = p_event_id and e.snapshot_taken_at is not null and s.active
  union all
  select m.id, m.group_id, m.church_id
  from public.members m
  where m.active
    and exists (select 1 from public.events e where e.id = p_event_id and e.snapshot_taken_at is null);
$$;

-- Fatos por convidado único (registros mesclados ficam de fora: nunca contam duas vezes).
create or replace function private.guest_facts(p_event_id uuid)
returns table (
  guest_id uuid, church_id uuid, group_id uuid, member_id uuid,
  category public.guest_category, mode public.participation_mode, invite_status public.invite_status,
  transport public.transport_need, is_walk_in boolean, created_at timestamptz,
  has_presencial boolean, has_online boolean, presencial_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select g.id, g.church_id, g.group_id, g.member_id, g.category, g.mode, g.invite_status, g.transport,
    g.is_walk_in, g.created_at,
    coalesce(a.has_presencial, false), coalesce(a.has_online, false), a.presencial_at
  from public.guests g
  left join (
    select at.guest_id,
      bool_or(at.type = 'presencial') as has_presencial,
      bool_or(at.type = 'online') as has_online,
      min(at.checked_in_at) filter (where at.type = 'presencial') as presencial_at
    from public.attendances at
    where at.event_id = p_event_id and at.revoked_at is null
    group by at.guest_id
  ) a on a.guest_id = g.id
  where g.event_id = p_event_id and g.merged_into_id is null;
$$;

create or replace function private.pct(p_value bigint, p_goal bigint)
returns numeric language sql immutable set search_path = '' as $$
  select case when p_goal > 0 then round(p_value * 100.0 / p_goal, 1) end;
$$;

-- ---------------------------------------------------------------------
-- Cálculo de um nível (Polo = ambos nulos; igreja; grupo). Sem checagem de escopo:
-- uso interno pelas funções públicas abaixo.
-- ---------------------------------------------------------------------
create or replace function private.compute_goal_stats(p_event_id uuid, p_church_id uuid, p_group_id uuid)
returns table (
  members_goal_base bigint, invites_goal bigint, attendance_goal bigint,
  guests_unique bigint, present_unique bigint, pct_invites numeric, pct_attendance numeric,
  confirmed bigint, online_confirmed bigint, online_registered bigint, online_only bigint, reach_total bigint,
  need_transport bigint, walk_ins bigint,
  members_met_invites bigint, members_below_invites bigint,
  members_met_attendance bigint, members_below_attendance bigint
)
language sql stable security definer
set search_path = ''
as $$
  with ev as (
    select invites_goal_per_member as gi, attendance_goal_per_member as ga from public.events where id = p_event_id
  ),
  base as (
    select b.* from private.goal_base(p_event_id) b
    where (p_church_id is null or b.church_id = p_church_id) and (p_group_id is null or b.group_id = p_group_id)
  ),
  facts_all as (select * from private.guest_facts(p_event_id)),
  facts as (
    select f.* from facts_all f
    where (p_church_id is null or f.church_id = p_church_id) and (p_group_id is null or f.group_id = p_group_id)
  ),
  per_member as (
    select b.member_id,
      (select count(*) from facts_all f where f.member_id = b.member_id) as invited,
      (select count(*) from facts_all f where f.member_id = b.member_id and f.has_presencial) as present
    from base b
  )
  select
    (select count(*) from base),
    (select count(*) from base) * (select gi from ev),
    (select count(*) from base) * (select ga from ev),
    (select count(*) from facts),
    (select count(*) from facts where has_presencial),
    private.pct((select count(*) from facts), (select count(*) from base) * (select gi from ev)),
    private.pct((select count(*) from facts where has_presencial), (select count(*) from base) * (select ga from ev)),
    (select count(*) from facts where invite_status = 'confirmou' and mode <> 'online'),
    (select count(*) from facts where invite_status = 'confirmou' and mode = 'online'),
    (select count(*) from facts where has_online),
    (select count(*) from facts where has_online and not has_presencial),
    (select count(*) from facts where has_presencial or has_online),
    (select count(*) from facts where mode <> 'online' and transport = 'precisa_transporte'),
    (select count(*) from facts where is_walk_in),
    (select count(*) from per_member where invited >= (select gi from ev)),
    (select count(*) from per_member where invited < (select gi from ev)),
    (select count(*) from per_member where present >= (select ga from ev)),
    (select count(*) from per_member where present < (select ga from ev));
$$;

-- ---------------------------------------------------------------------
-- Funções públicas com escopo (números agregados, sem dados pessoais)
-- ---------------------------------------------------------------------
create or replace function private.can_view_stats(p_church_id uuid, p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_group_id is not null then
      p_group_id = any (private.my_led_group_ids())
      or exists (select 1 from public.assistance_groups g where g.id = p_group_id
                 and g.church_id = any (private.my_stats_church_ids()))
    when p_church_id is not null then p_church_id = any (private.my_stats_church_ids())
    else private.can_view_polo_stats()
  end;
$$;

create or replace function public.goal_summary(p_event_id uuid default null, p_church_id uuid default null,
  p_group_id uuid default null)
returns table (
  members_goal_base bigint, invites_goal bigint, attendance_goal bigint,
  guests_unique bigint, present_unique bigint, pct_invites numeric, pct_attendance numeric,
  confirmed bigint, online_confirmed bigint, online_registered bigint, online_only bigint, reach_total bigint,
  need_transport bigint, walk_ins bigint,
  members_met_invites bigint, members_below_invites bigint,
  members_met_attendance bigint, members_below_attendance bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event uuid := coalesce(p_event_id, private.active_event_id());
begin
  if v_event is null or not private.can_view_stats(p_church_id, p_group_id) then
    return;
  end if;
  return query select * from private.compute_goal_stats(v_event, p_church_id, p_group_id);
end;
$$;

create or replace function public.goal_by_church(p_event_id uuid default null)
returns table (
  church_id uuid, church_name text,
  members_goal_base bigint, invites_goal bigint, attendance_goal bigint,
  guests_unique bigint, present_unique bigint, pct_invites numeric, pct_attendance numeric,
  confirmed bigint, online_confirmed bigint, online_registered bigint, online_only bigint, reach_total bigint,
  need_transport bigint, walk_ins bigint,
  members_met_invites bigint, members_below_invites bigint,
  members_met_attendance bigint, members_below_attendance bigint
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, s.*
  from public.churches c
  cross join lateral private.compute_goal_stats(coalesce(p_event_id, private.active_event_id()), c.id, null) s
  where c.id = any (private.my_stats_church_ids())
    and coalesce(p_event_id, private.active_event_id()) is not null
  order by c.name;
$$;

create or replace function public.goal_by_group(p_event_id uuid default null, p_church_id uuid default null)
returns table (
  group_id uuid, group_name text, church_id uuid, church_name text, group_active boolean,
  members_goal_base bigint, invites_goal bigint, attendance_goal bigint,
  guests_unique bigint, present_unique bigint, pct_invites numeric, pct_attendance numeric,
  confirmed bigint, online_confirmed bigint, online_registered bigint, online_only bigint, reach_total bigint,
  need_transport bigint, walk_ins bigint,
  members_met_invites bigint, members_below_invites bigint,
  members_met_attendance bigint, members_below_attendance bigint
)
language sql stable security definer
set search_path = ''
as $$
  select g.id, g.name, c.id, c.name, g.active, s.*
  from public.assistance_groups g
  join public.churches c on c.id = g.church_id
  cross join lateral private.compute_goal_stats(coalesce(p_event_id, private.active_event_id()), null, g.id) s
  where (p_church_id is null or g.church_id = p_church_id)
    and (g.church_id = any (private.my_stats_church_ids()) or g.id = any (private.my_led_group_ids()))
    and coalesce(p_event_id, private.active_event_id()) is not null
  order by c.name, g.name;
$$;

-- Desempenho por membro (com nomes): somente quem tem acesso aos dados do membro.
create or replace function public.member_goal_stats(p_event_id uuid default null, p_group_id uuid default null,
  p_member_id uuid default null)
returns table (
  member_id uuid, full_name text, group_id uuid, group_name text, church_id uuid, member_active boolean,
  in_goal boolean, invites_goal int, attendance_goal int, invited bigint, present bigint,
  online bigint, met_invites boolean, met_attendance boolean
)
language sql stable security definer
set search_path = ''
as $$
  with ev as (
    select id, invites_goal_per_member gi, attendance_goal_per_member ga
    from public.events where id = coalesce(p_event_id, private.active_event_id())
  ),
  base as (select b.member_id from private.goal_base((select id from ev)) b),
  facts as (select * from private.guest_facts((select id from ev)))
  select m.id, m.full_name, m.group_id, g.name, m.church_id, m.active,
    (m.id in (select member_id from base)),
    case when m.id in (select member_id from base) then (select gi from ev) else 0 end,
    case when m.id in (select member_id from base) then (select ga from ev) else 0 end,
    (select count(*) from facts f where f.member_id = m.id),
    (select count(*) from facts f where f.member_id = m.id and f.has_presencial),
    (select count(*) from facts f where f.member_id = m.id and f.has_online and not f.has_presencial),
    (select count(*) from facts f where f.member_id = m.id)
      >= case when m.id in (select member_id from base) then (select gi from ev) else 0 end,
    (select count(*) from facts f where f.member_id = m.id and f.has_presencial)
      >= case when m.id in (select member_id from base) then (select ga from ev) else 0 end
  from public.members m
  join public.assistance_groups g on g.id = m.group_id
  where exists (select 1 from ev)
    and (p_group_id is null or m.group_id = p_group_id)
    and (p_member_id is null or m.id = p_member_id)
    and private.has_record_access(m.church_id, m.group_id)
    and (m.active or m.id in (select member_id from base)
         or exists (select 1 from facts f where f.member_id = m.id))
  order by g.name, m.full_name;
$$;

-- ---------------------------------------------------------------------
-- Snapshot na data de corte
-- ---------------------------------------------------------------------
create or replace function private.take_goal_snapshot(p_event_id uuid)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.goal_snapshots (event_id, member_id, group_id, church_id, active)
  select p_event_id, m.id, m.group_id, m.church_id, m.active from public.members m
  on conflict (event_id, member_id) do nothing;
  get diagnostics v_count = row_count;
  update public.events set snapshot_taken_at = now() where id = p_event_id and snapshot_taken_at is null;
  return v_count;
end;
$$;

-- Executado periodicamente (pg_cron) e quando o Admin altera a data de corte.
create or replace function private.take_due_snapshots()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  e record;
  v_total int := 0;
begin
  for e in select id from public.events
           where cutoff_at is not null and cutoff_at <= now() and snapshot_taken_at is null
  loop
    v_total := v_total + private.take_goal_snapshot(e.id);
  end loop;
  return v_total;
end;
$$;

-- Ação manual do Admin: gravar agora (ou refazer, se a edição não estiver encerrada).
create or replace function public.take_goal_snapshot_now(p_event_id uuid, p_replace boolean default false)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event record;
  v_count int;
begin
  if not private.is_polo_admin() then
    raise exception 'Somente o Administrador do Polo grava o snapshot das metas.' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Evento não encontrado.' using errcode = 'P0001';
  end if;
  if v_event.snapshot_taken_at is not null then
    if not p_replace then
      raise exception 'O snapshot desta edição já foi gravado em %.', v_event.snapshot_taken_at using errcode = 'P0001';
    end if;
    if v_event.status = 'encerrado' then
      raise exception 'Edição encerrada: o snapshot não pode ser refeito.' using errcode = 'P0001';
    end if;
    delete from public.goal_snapshots where event_id = p_event_id;
    update public.events set snapshot_taken_at = null where id = p_event_id;
  end if;
  v_count := private.take_goal_snapshot(p_event_id);
  perform public.write_audit('metas.snapshot', 'events', p_event_id::text, null,
    jsonb_build_object('refeito', p_replace), jsonb_build_object('membros', v_count));
  return v_count;
end;
$$;

-- Corte no passado ao salvar, ou encerramento sem snapshot → grava na hora.
create or replace function public.events_after_update_goals()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.snapshot_taken_at is null and (
       (new.cutoff_at is not null and new.cutoff_at <= now())
       or (new.status = 'encerrado' and old.status <> 'encerrado')
     ) then
    perform private.take_goal_snapshot(new.id);
  end if;
  return null;
end;
$$;

create trigger events_after_update_goals after update of cutoff_at, status on public.events
  for each row execute function public.events_after_update_goals();

-- Agendamento a cada minuto (pg_cron), quando a extensão estiver disponível.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('tef-snapshot-metas', '* * * * *', 'select private.take_due_snapshots()');
  else
    raise notice 'pg_cron indisponível: o snapshot será gravado ao salvar o evento ou pelo botão do Admin.';
  end if;
exception when others then
  raise notice 'Não foi possível agendar o snapshot: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.goal_summary(uuid, uuid, uuid) from public, anon;
revoke execute on function public.goal_by_church(uuid) from public, anon;
revoke execute on function public.goal_by_group(uuid, uuid) from public, anon;
revoke execute on function public.member_goal_stats(uuid, uuid, uuid) from public, anon;
revoke execute on function public.take_goal_snapshot_now(uuid, boolean) from public, anon;
revoke execute on function public.events_after_update_goals() from public, anon, authenticated;
grant execute on function public.goal_summary(uuid, uuid, uuid), public.goal_by_church(uuid),
  public.goal_by_group(uuid, uuid), public.member_goal_stats(uuid, uuid, uuid),
  public.take_goal_snapshot_now(uuid, boolean) to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
