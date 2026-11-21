-- =====================================================================
-- Fase 6 — Check-in, cadastro na chegada (walk-in), desmarcação e sinal de tempo real (seções 11 e 12)
-- =====================================================================

-- Busca por trechos do telefone (ex.: últimos 4 dígitos) usa índice trigram.
create index if not exists guests_phone_trgm_idx on public.guests using gin (phone_normalized extensions.gin_trgm_ops);
create index if not exists guests_guardian_phone_trgm_idx on public.guests using gin (guardian_phone extensions.gin_trgm_ops);
create index if not exists members_name_normalized_trgm_idx on public.members
  using gin (public.normalize_name(full_name) extensions.gin_trgm_ops);

-- Máscara da Recepção/Leitor: (83) 9****-1234 — mesma regra de src/lib/phone.ts.
create or replace function private.mask_phone(p_e164 text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_e164 is null then null
    when length(regexp_replace(p_e164, '^\+55', '')) = 11 then
      '(' || substr(regexp_replace(p_e164, '^\+55', ''), 1, 2) || ') ' || substr(regexp_replace(p_e164, '^\+55', ''), 3, 1)
      || '****-' || substr(regexp_replace(p_e164, '^\+55', ''), 8, 4)
    when length(regexp_replace(p_e164, '^\+55', '')) = 10 then
      '(' || substr(regexp_replace(p_e164, '^\+55', ''), 1, 2) || ') ****-' || substr(regexp_replace(p_e164, '^\+55', ''), 7, 4)
    else '****'
  end;
$$;

create or replace function private.profile_name(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) from public.profiles where id = p_id;
$$;

-- ---------------------------------------------------------------------
-- Busca do check-in: nome ou telefone, telefone sempre mascarado, evento ativo, todas as igrejas.
-- ---------------------------------------------------------------------
create or replace function public.search_checkin(p_query text, p_limit int default 20)
returns table (
  guest_id uuid, full_name text, category public.guest_category, church_name text, group_name text,
  member_name text, phone_masked text, mode public.participation_mode,
  presencial_at timestamptz, presencial_by text, online_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_event uuid := private.active_event_id();
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_name text := public.normalize_name(p_query);
begin
  if not private.can_check_in() then
    raise exception 'Seu perfil não opera o check-in.' using errcode = '42501';
  end if;
  if v_event is null then
    raise exception 'Nenhum evento ativo.' using errcode = 'P0001';
  end if;
  if length(v_digits) < 4 and length(v_name) < 2 then
    return;
  end if;
  return query
  select g.id, g.full_name, g.category, c.name, gr.name, m.full_name,
    private.mask_phone(coalesce(g.phone_normalized, g.guardian_phone)), g.mode,
    ap.checked_in_at, private.profile_name(ap.checked_in_by), ao.checked_in_at
  from public.guests g
  join public.churches c on c.id = g.church_id
  left join public.assistance_groups gr on gr.id = g.group_id
  left join public.members m on m.id = g.member_id
  left join public.attendances ap on ap.guest_id = g.id and ap.type = 'presencial' and ap.revoked_at is null
  left join public.attendances ao on ao.guest_id = g.id and ao.type = 'online' and ao.revoked_at is null
  where g.event_id = v_event
    and g.merged_into_id is null
    and g.anonymized_at is null
    and (
      (length(v_digits) >= 4 and (g.phone_normalized like '%' || v_digits || '%' or g.guardian_phone like '%' || v_digits || '%'))
      or (length(v_digits) < 4 and (g.name_normalized like '%' || v_name || '%' or g.name_normalized operator(extensions.%) v_name))
    )
  order by (g.name_normalized like v_name || '%') desc,
    extensions.similarity(g.name_normalized, v_name) desc, g.full_name
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- Busca de membro para o cadastro na chegada (apenas nome, grupo e igreja).
create or replace function public.search_members_for_walkin(p_query text)
returns table (member_id uuid, full_name text, group_name text, church_id uuid, church_name text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_name text := public.normalize_name(p_query);
begin
  if not private.can_check_in() then
    raise exception 'Seu perfil não opera o check-in.' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    return;
  end if;
  return query
  select m.id, m.full_name, g.name, c.id, c.name
  from public.members m
  join public.assistance_groups g on g.id = m.group_id
  join public.churches c on c.id = m.church_id
  where m.active and public.normalize_name(m.full_name) like '%' || v_name || '%'
  order by m.full_name
  limit 15;
end;
$$;

-- ---------------------------------------------------------------------
-- Marcar presença: atômica e idempotente.
-- Duas recepções ao mesmo tempo → uma registra, a outra recebe "já registrada".
-- O mesmo client_request_id reenviado (fila offline) devolve o mesmo resultado.
-- ---------------------------------------------------------------------
create or replace function public.check_in(
  p_guest_id uuid, p_client_request_id uuid default null, p_type public.attendance_type default 'presencial'
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  g record;
  v_existing record;
  v_id uuid;
  v_user uuid := private.current_profile_id();
begin
  if p_client_request_id is not null then
    select a.id, a.checked_in_at, a.checked_in_by, a.guest_id into v_existing
    from public.attendances a where a.client_request_id = p_client_request_id;
    if found then
      return jsonb_build_object('status', 'registrada', 'attendance_id', v_existing.id,
        'checked_in_at', v_existing.checked_in_at, 'checked_in_by', private.profile_name(v_existing.checked_in_by),
        'repetida', true);
    end if;
  end if;

  select id, event_id, church_id, group_id, merged_into_id, anonymized_at into g
  from public.guests where id = p_guest_id;
  if not found then
    raise exception 'Convidado não encontrado.' using errcode = 'P0001';
  end if;
  if g.merged_into_id is not null then
    -- Registro mesclado: a presença vai para o registro mantido.
    return public.check_in(g.merged_into_id, p_client_request_id, p_type);
  end if;
  if p_type = 'presencial' then
    if not private.can_check_in() then
      raise exception 'Seu perfil não pode marcar presença.' using errcode = '42501';
    end if;
    if g.event_id is distinct from private.active_event_id() then
      raise exception 'O check-in presencial só funciona para a edição ativa.' using errcode = 'P0001';
    end if;
  else
    -- Online é autodeclarado (informado pelo membro/gestor).
    if not (private.has_record_access(g.church_id, g.group_id)) then
      raise exception 'Você não tem permissão para registrar participação online deste convidado.' using errcode = '42501';
    end if;
    if not private.event_is_open(g.event_id) then
      raise exception 'Esta edição do evento está encerrada (somente leitura).' using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.attendances (event_id, guest_id, type, checked_in_by, client_request_id)
    values (g.event_id, g.id, p_type, v_user, p_client_request_id)
    on conflict (event_id, guest_id, type) where revoked_at is null do nothing
    returning id into v_id;
  exception when unique_violation then
    -- Mesmo client_request_id enviado duas vezes ao mesmo tempo: devolve o registro existente.
    select a.id, a.checked_in_at, a.checked_in_by into v_existing
    from public.attendances a where a.client_request_id = p_client_request_id;
    return jsonb_build_object('status', 'registrada', 'attendance_id', v_existing.id,
      'checked_in_at', v_existing.checked_in_at, 'checked_in_by', private.profile_name(v_existing.checked_in_by),
      'repetida', true);
  end;

  if v_id is not null then
    return jsonb_build_object('status', 'registrada', 'attendance_id', v_id, 'checked_in_at', now(),
      'checked_in_by', private.profile_name(v_user), 'repetida', false);
  end if;

  select a.id, a.checked_in_at, a.checked_in_by into v_existing
  from public.attendances a
  where a.event_id = g.event_id and a.guest_id = g.id and a.type = p_type and a.revoked_at is null;
  return jsonb_build_object('status', 'ja_registrada', 'attendance_id', v_existing.id,
    'checked_in_at', v_existing.checked_in_at, 'checked_in_by', private.profile_name(v_existing.checked_in_by));
end;
$$;

-- ---------------------------------------------------------------------
-- Desmarcar presença: somente Gestor da igreja ou Admin, com motivo. Nunca apaga a linha.
-- ---------------------------------------------------------------------
create or replace function public.revoke_attendance(p_guest_id uuid, p_type public.attendance_type, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  g record;
begin
  select id, event_id, church_id into g from public.guests where id = p_guest_id;
  if not found then
    raise exception 'Convidado não encontrado.' using errcode = 'P0001';
  end if;
  if not private.has_church_access(g.church_id) then
    raise exception 'Somente o Gestor da igreja ou o Administrador pode desmarcar presença.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo da desmarcação.' using errcode = 'P0001';
  end if;
  if not private.event_is_open(g.event_id) then
    raise exception 'Esta edição do evento está encerrada (somente leitura).' using errcode = 'P0001';
  end if;
  update public.attendances
  set revoked_at = now(), revoked_by = private.current_profile_id(), revoke_reason = left(trim(p_reason), 500)
  where guest_id = p_guest_id and type = p_type and revoked_at is null;
  if not found then
    raise exception 'Não há presença ativa para desmarcar.' using errcode = 'P0001';
  end if;
end;
$$;

-- Histórico de presença do convidado (com nomes de quem marcou/desmarcou).
create or replace function public.attendance_history(p_guest_id uuid)
returns table (
  id uuid, type public.attendance_type, checked_in_at timestamptz, checked_in_by text,
  revoked_at timestamptz, revoked_by text, revoke_reason text
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.type, a.checked_in_at, private.profile_name(a.checked_in_by),
    a.revoked_at, private.profile_name(a.revoked_by), a.revoke_reason
  from public.attendances a
  join public.guests g on g.id = a.guest_id
  where a.guest_id = p_guest_id
    and (private.has_record_access(g.church_id, g.group_id) or private.can_check_in())
  order by a.checked_in_at desc;
$$;

-- ---------------------------------------------------------------------
-- Cadastro na chegada + presença (walk-in)
-- ---------------------------------------------------------------------
create or replace function public.walk_in_check_in(
  p_full_name text,
  p_category public.guest_category,
  p_consent boolean,
  p_phone text default null,
  p_member_id uuid default null,
  p_church_id uuid default null,
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_client_request_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event uuid := private.active_event_id();
  v_member record;
  v_church uuid;
  v_group uuid;
  v_phone text;
  v_guardian_phone text;
  v_minor boolean := p_category in ('crianca', 'adolescente');
  v_guest uuid;
  v_user uuid := private.current_profile_id();
  v_existing record;
  v_result jsonb;
begin
  if not private.can_check_in() then
    raise exception 'Seu perfil não opera o check-in.' using errcode = '42501';
  end if;
  if v_event is null then
    raise exception 'Nenhum evento ativo.' using errcode = 'P0001';
  end if;
  -- Reenvio da fila offline: devolve o que já foi feito.
  if p_client_request_id is not null then
    select a.guest_id, a.checked_in_at into v_existing from public.attendances a
    where a.client_request_id = p_client_request_id;
    if found then
      return jsonb_build_object('status', 'registrada', 'guest_id', v_existing.guest_id,
        'checked_in_at', v_existing.checked_in_at, 'repetida', true);
    end if;
  end if;
  if length(trim(coalesce(p_full_name, ''))) < 3 then
    raise exception 'Informe o nome completo.' using errcode = 'P0001';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Registre o consentimento %.',
      case when v_minor then 'do responsável legal' else 'do convidado' end using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is not null then
    v_phone := public.normalize_phone(p_phone);
    if v_phone is null then
      raise exception 'Telefone inválido. Use DDD + número.' using errcode = 'P0001';
    end if;
  end if;
  if v_minor then
    if length(trim(coalesce(p_guardian_name, ''))) < 3 then
      raise exception 'Para criança ou adolescente, informe o nome do responsável legal.' using errcode = 'P0001';
    end if;
    v_guardian_phone := public.normalize_phone(p_guardian_phone);
    if v_guardian_phone is null then
      raise exception 'Informe um telefone válido do responsável legal.' using errcode = 'P0001';
    end if;
  elsif v_phone is null then
    raise exception 'O telefone é obrigatório (exceto para criança e adolescente).' using errcode = 'P0001';
  end if;

  if p_member_id is not null then
    select id, church_id, group_id into v_member from public.members where id = p_member_id;
    if not found then
      raise exception 'Membro não encontrado.' using errcode = 'P0001';
    end if;
    v_church := v_member.church_id;
    v_group := v_member.group_id;
  else
    -- "Sem membro identificado": entra nos totais do Polo e da igreja, não nas metas individuais.
    if p_church_id is null or not exists (select 1 from public.churches where id = p_church_id) then
      raise exception 'Sem membro identificado: escolha a igreja.' using errcode = 'P0001';
    end if;
    v_church := p_church_id;
  end if;

  insert into public.guests (
    event_id, full_name, phone_normalized, category, mode, transport, invite_status,
    guardian_name, guardian_phone, church_id, group_id, member_id, is_walk_in, created_by, updated_by
  ) values (
    v_event, p_full_name, v_phone, p_category, 'presencial', 'meios_proprios', 'confirmou',
    case when v_minor then trim(p_guardian_name) end, v_guardian_phone,
    v_church, v_group, p_member_id, true, v_user, v_user
  ) returning id into v_guest;

  insert into public.guest_referrals (guest_id, event_id, member_id, church_id, group_id, is_primary, created_by)
  values (v_guest, v_event, p_member_id, v_church, v_group, true, v_user);
  insert into public.guest_consents (guest_id, consent_text, given_by_guardian, guardian_name, recorded_by)
  values (v_guest, private.consent_text(v_minor), v_minor, case when v_minor then trim(p_guardian_name) end, v_user);

  perform private.detect_guest_duplicates(v_guest);
  v_result := public.check_in(v_guest, p_client_request_id, 'presencial');
  return v_result || jsonb_build_object('guest_id', v_guest);
end;
$$;

-- ---------------------------------------------------------------------
-- Tempo real: apenas um SINAL ("algo mudou"), sem dados pessoais (seção 12).
-- Um aviso por comando (statement-level), não por linha.
-- ---------------------------------------------------------------------
create or replace function public.notify_stats_changed()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('tabela', tg_table_name, 'em', now()),
    'mudou',
    'tef-sinal',
    false
  );
  return null;
exception when others then
  -- O sinal é acessório: nunca impede a gravação.
  return null;
end;
$$;

create trigger guests_notify after insert or update or delete on public.guests
  for each statement execute function public.notify_stats_changed();
create trigger attendances_notify after insert or update or delete on public.attendances
  for each statement execute function public.notify_stats_changed();
create trigger members_notify after insert or update or delete on public.members
  for each statement execute function public.notify_stats_changed();
create trigger transport_notify after insert or update on public.transport_requests
  for each statement execute function public.notify_stats_changed();

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.search_checkin(text, int) from public, anon;
revoke execute on function public.search_members_for_walkin(text) from public, anon;
revoke execute on function public.check_in(uuid, uuid, public.attendance_type) from public, anon;
revoke execute on function public.revoke_attendance(uuid, public.attendance_type, text) from public, anon;
revoke execute on function public.attendance_history(uuid) from public, anon;
revoke execute on function public.walk_in_check_in(text, public.guest_category, boolean, text, uuid, uuid, text, text, uuid)
  from public, anon;
revoke execute on function public.notify_stats_changed() from public, anon, authenticated;
grant execute on function public.search_checkin(text, int), public.search_members_for_walkin(text),
  public.check_in(uuid, uuid, public.attendance_type), public.revoke_attendance(uuid, public.attendance_type, text),
  public.attendance_history(uuid),
  public.walk_in_check_in(text, public.guest_category, boolean, text, uuid, uuid, text, text, uuid)
  to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
