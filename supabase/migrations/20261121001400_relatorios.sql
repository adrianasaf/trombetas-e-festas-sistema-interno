-- =====================================================================
-- Fase 8 — Relatórios, transporte e auditoria de exportações (seções 9, 14 e 16)
-- =====================================================================

-- Lista de convidados para relatório. SECURITY INVOKER: a RLS de guests decide quem vê cada linha
-- (Admin, Gestor da igreja, Responsável do grupo). Recepção e Leitor recebem lista vazia.
create or replace function public.report_guests(
  p_event_id uuid default null,
  p_church_id uuid default null,
  p_group_id uuid default null,
  p_member_id uuid default null,
  p_category public.guest_category default null,
  p_special text default null,          -- 'autoridade' | 'pastor'
  p_invite_status public.invite_status default null,
  p_transport public.transport_need default null,
  p_presence text default null,         -- 'presente' | 'ausente'
  p_online text default null            -- 'online' | 'nao_online'
)
returns table (
  guest_id uuid, full_name text, phone text, category public.guest_category,
  is_authority boolean, is_other_church_pastor boolean, mode public.participation_mode,
  transport public.transport_need, invite_status public.invite_status,
  church_name text, group_name text, member_name text, is_walk_in boolean,
  guardian_name text, created_at timestamptz,
  presencial_at timestamptz, online_at timestamptz
)
language sql stable security invoker
set search_path = ''
as $$
  select g.id, g.full_name, coalesce(g.phone_normalized, g.guardian_phone), g.category,
    g.is_authority, g.is_other_church_pastor, g.mode, g.transport, g.invite_status,
    c.name, gr.name, m.full_name, g.is_walk_in, g.guardian_name, g.created_at,
    ap.checked_in_at, ao.checked_in_at
  from public.guests g
  join public.churches c on c.id = g.church_id
  left join public.assistance_groups gr on gr.id = g.group_id
  left join public.members m on m.id = g.member_id
  left join public.attendances ap on ap.guest_id = g.id and ap.type = 'presencial' and ap.revoked_at is null
  left join public.attendances ao on ao.guest_id = g.id and ao.type = 'online' and ao.revoked_at is null
  where g.event_id = coalesce(p_event_id, (select id from public.events where status = 'ativo' limit 1))
    and g.merged_into_id is null
    and (p_church_id is null or g.church_id = p_church_id)
    and (p_group_id is null or g.group_id = p_group_id)
    and (p_member_id is null or g.member_id = p_member_id)
    and (p_category is null or g.category = p_category)
    and (p_special is null or (p_special = 'autoridade' and g.is_authority)
         or (p_special = 'pastor' and g.is_other_church_pastor))
    and (p_invite_status is null or g.invite_status = p_invite_status)
    and (p_transport is null or (g.transport = p_transport and g.mode <> 'online'))
    and (p_presence is null or (p_presence = 'presente') = (ap.id is not null))
    and (p_online is null or (p_online = 'online') = (ao.id is not null))
  order by c.name, gr.name nulls last, g.full_name;
$$;

-- Lista do módulo de transporte (invoker: RLS de guests/transport_requests).
create or replace function public.transport_list(
  p_event_id uuid default null, p_church_id uuid default null, p_group_id uuid default null,
  p_status public.transport_status default null
)
returns table (
  request_id uuid, guest_id uuid, full_name text, phone text, church_name text, group_name text,
  member_name text, status public.transport_status, driver_name text, pickup_point text, notes text,
  updated_at timestamptz
)
language sql stable security invoker
set search_path = ''
as $$
  select t.id, g.id, g.full_name, coalesce(g.phone_normalized, g.guardian_phone), c.name, gr.name, m.full_name,
    t.status, t.driver_name, t.pickup_point, t.notes, t.updated_at
  from public.transport_requests t
  join public.guests g on g.id = t.guest_id
  join public.churches c on c.id = g.church_id
  left join public.assistance_groups gr on gr.id = g.group_id
  left join public.members m on m.id = g.member_id
  where t.event_id = coalesce(p_event_id, (select id from public.events where status = 'ativo' limit 1))
    and t.cancelled_at is null and g.merged_into_id is null
    and (p_church_id is null or g.church_id = p_church_id)
    and (p_group_id is null or g.group_id = p_group_id)
    and (p_status is null or t.status = p_status)
  order by t.status, c.name, g.full_name;
$$;

-- Registro de exportação (auditoria). Exportar COM telefone: só Admin ou Gestor da igreja filtrada.
create or replace function public.log_export(
  p_kind text, p_event_id uuid, p_church_id uuid, p_rows int, p_with_phone boolean, p_filters jsonb default '{}'
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_any_role() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_kind not in ('convidados', 'transporte', 'relatorio_final', 'desempenho') then
    raise exception 'Tipo de exportação inválido.' using errcode = '22023';
  end if;
  if p_with_phone and not (
    private.is_polo_admin() or (p_church_id is not null and private.has_church_access(p_church_id))
  ) then
    raise exception 'Exportação com telefone é permitida apenas ao Gestor da igreja e ao Administrador.'
      using errcode = '42501';
  end if;
  perform public.write_audit('exportacao.' || p_kind, 'exportacoes', null, p_church_id, null,
    jsonb_build_object('linhas', p_rows, 'com_telefone', p_with_phone, 'evento', p_event_id,
                       'filtros', coalesce(p_filters, '{}'::jsonb)));
end;
$$;

-- Auditoria do transporte (situação e responsável).
create trigger audit_transport_requests after update on public.transport_requests
  for each row execute function public.audit_trigger();

revoke execute on function public.report_guests(uuid, uuid, uuid, uuid, public.guest_category, text,
  public.invite_status, public.transport_need, text, text) from public, anon;
revoke execute on function public.transport_list(uuid, uuid, uuid, public.transport_status) from public, anon;
revoke execute on function public.log_export(text, uuid, uuid, int, boolean, jsonb) from public, anon;
grant execute on function public.report_guests(uuid, uuid, uuid, uuid, public.guest_category, text,
  public.invite_status, public.transport_need, text, text) to authenticated;
grant execute on function public.transport_list(uuid, uuid, uuid, public.transport_status) to authenticated;
grant execute on function public.log_export(text, uuid, uuid, int, boolean, jsonb) to authenticated;
