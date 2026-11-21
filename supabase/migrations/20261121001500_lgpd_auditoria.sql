-- =====================================================================
-- Fase 9 — LGPD (anonimização, direitos do titular) e consulta de auditoria (seções 14 e 15)
-- =====================================================================

-- Anonimiza um convidado: nome e telefones substituídos; estatísticas preservadas (a linha continua).
create or replace function private.anonymize_guest_row(p_guest_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.guests set
    full_name = 'Convidado anonimizado ' || upper(left(replace(id::text, '-', ''), 8)),
    phone_normalized = null,
    guardian_name = null,
    guardian_phone = null,
    notes = null,
    anonymized_at = coalesce(anonymized_at, now())
  where id = p_guest_id or merged_into_id = p_guest_id;
  update public.guest_consents set guardian_name = null
  where guest_id = p_guest_id;
  update public.transport_requests set driver_name = null, pickup_point = null, notes = null
  where guest_id = p_guest_id;
  -- Duplicidades pendentes perdem o sentido sem nome/telefone.
  update public.duplicate_reviews set status = 'pessoas_diferentes', resolved_at = now(),
    resolution_note = 'Encerrada por anonimização (LGPD)'
  where status = 'pendente' and (guest_id = p_guest_id or candidate_guest_id = p_guest_id);
end;
$$;

-- Retenção: anonimizar toda a edição encerrada depois do prazo configurado.
create or replace function public.anonymize_event(p_event_id uuid)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  e record;
  s record;
  g record;
  v_count int := 0;
begin
  if not private.is_polo_admin() then
    raise exception 'Somente o Administrador do Polo executa a anonimização.' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Evento não encontrado.' using errcode = 'P0001';
  end if;
  select * into s from public.event_settings where event_id = p_event_id;
  if e.status <> 'encerrado' or e.closed_at is null then
    raise exception 'Só é possível anonimizar uma edição encerrada.' using errcode = 'P0001';
  end if;
  if e.closed_at + make_interval(days => s.retention_days) > now() then
    raise exception 'O prazo de retenção (% dias) termina em %.', s.retention_days,
      to_char((e.closed_at + make_interval(days => s.retention_days)) at time zone 'America/Fortaleza', 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  for g in select id from public.guests where event_id = p_event_id and anonymized_at is null and merged_into_id is null loop
    perform private.anonymize_guest_row(g.id);
    v_count := v_count + 1;
  end loop;
  update public.event_settings set anonymized_at = now(), anonymized_by = private.current_profile_id()
  where event_id = p_event_id;
  perform public.write_audit('lgpd.anonimizar_evento', 'events', p_event_id::text, null, null,
    jsonb_build_object('convidados', v_count, 'retencao_dias', s.retention_days));
  return v_count;
end;
$$;

-- Direito do titular: localizar (em todas as edições) — somente Admin.
create or replace function public.find_titular(p_query text)
returns table (guest_id uuid, full_name text, phone text, guardian_name text, event_name text,
  church_name text, created_at timestamptz, anonymized_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_name text := public.normalize_name(p_query);
begin
  if not private.is_polo_admin() then
    raise exception 'Somente o Administrador do Polo atende pedidos do titular.' using errcode = '42501';
  end if;
  return query
  select g.id, g.full_name, coalesce(g.phone_normalized, g.guardian_phone), g.guardian_name, e.name, c.name,
    g.created_at, g.anonymized_at
  from public.guests g
  join public.events e on e.id = g.event_id
  join public.churches c on c.id = g.church_id
  where g.merged_into_id is null
    and ((length(v_digits) >= 8 and (g.phone_normalized like '%' || v_digits || '%' or g.guardian_phone like '%' || v_digits || '%'))
      or (length(v_digits) < 8 and length(v_name) >= 3 and g.name_normalized like '%' || v_name || '%'))
  order by g.created_at desc
  limit 50;
end;
$$;

-- Direito do titular: anonimizar (mantém estatísticas) ou excluir (remove tudo, inclusive presenças).
create or replace function public.titular_request(p_guest_id uuid, p_action text, p_justification text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  g record;
begin
  if not private.is_polo_admin() then
    raise exception 'Somente o Administrador do Polo atende pedidos do titular.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_justification, ''))) < 10 then
    raise exception 'Descreva o pedido do titular (mínimo de 10 caracteres).' using errcode = 'P0001';
  end if;
  select id, church_id, event_id into g from public.guests where id = p_guest_id;
  if not found then
    raise exception 'Convidado não encontrado.' using errcode = 'P0001';
  end if;
  if p_action = 'anonimizar' then
    perform private.anonymize_guest_row(p_guest_id);
  elsif p_action = 'excluir' then
    delete from public.attendances where guest_id in (select id from public.guests where id = p_guest_id or merged_into_id = p_guest_id);
    delete from public.duplicate_reviews where guest_id = p_guest_id or candidate_guest_id = p_guest_id;
    delete from public.guests where merged_into_id = p_guest_id;
    delete from public.guests where id = p_guest_id;
  else
    raise exception 'Ação inválida: use anonimizar ou excluir.' using errcode = '22023';
  end if;
  -- Registro sem dados pessoais (só o id e a justificativa).
  perform public.write_audit('lgpd.titular_' || p_action, 'guests', p_guest_id::text, g.church_id, null,
    jsonb_build_object('justificativa', trim(p_justification)));
end;
$$;

-- Auditoria para a tela: Admin vê tudo; Gestor vê a(s) sua(s) igreja(s).
create or replace function public.list_audit_logs(
  p_limit int default 50, p_before_id bigint default null, p_action text default null, p_church_id uuid default null
)
returns table (id bigint, created_at timestamptz, user_name text, action text, table_name text, record_id text,
  church_name text, old_data jsonb, new_data jsonb, ip text)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.created_at, private.profile_name(a.user_id), a.action, a.table_name, a.record_id,
    c.name, a.old_data, a.new_data, a.ip
  from public.audit_logs a
  left join public.churches c on c.id = a.church_id
  where (private.is_polo_admin() or a.church_id = any (private.my_managed_church_ids()))
    and (p_before_id is null or a.id < p_before_id)
    and (p_action is null or a.action like p_action || '%')
    and (p_church_id is null or a.church_id = p_church_id)
  order by a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- Auditoria do registro de pedidos de exclusão (a linha do convidado some; o log fica).
revoke execute on function public.anonymize_event(uuid) from public, anon;
revoke execute on function public.find_titular(text) from public, anon;
revoke execute on function public.titular_request(uuid, text, text) from public, anon;
revoke execute on function public.list_audit_logs(int, bigint, text, uuid) from public, anon;
grant execute on function public.anonymize_event(uuid), public.find_titular(text),
  public.titular_request(uuid, text, text), public.list_audit_logs(int, bigint, text, uuid) to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
