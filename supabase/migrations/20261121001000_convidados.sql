-- =====================================================================
-- Fase 4 — Convidados, consentimento, duplicidades e regra de crédito (seção 8)
-- =====================================================================

-- Texto do consentimento gravado junto com cada registro (LGPD).
create or replace function private.consent_text(p_minor boolean)
returns text language sql immutable set search_path = '' as $$
  select case when p_minor
    then 'O responsável legal autorizou o uso do nome e telefone do menor para contato sobre o evento (LGPD, art. 14).'
    else 'O convidado autorizou o uso do nome e telefone para contato sobre o evento.'
  end;
$$;

-- ---------------------------------------------------------------------
-- Regras de preenchimento (inserção e edição)
-- ---------------------------------------------------------------------
create or replace function public.guests_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := regexp_replace(trim(new.full_name), '\s+', ' ', 'g');
  -- Online: transporte oculto e zerado. Demais: transporte obrigatório (padrão "indefinido").
  if new.mode = 'online' then
    new.transport := null;
  elsif new.transport is null then
    new.transport := 'indefinido';
  end if;
  if new.category not in ('crianca', 'adolescente') and new.anonymized_at is null then
    new.guardian_name := null;
    new.guardian_phone := null;
  end if;
  if new.notes is not null and trim(new.notes) = '' then
    new.notes := null;
  end if;
  return new;
end;
$$;

create trigger guests_before_write before insert or update on public.guests
  for each row execute function public.guests_before_write();

-- ---------------------------------------------------------------------
-- Transporte: cria/cancela a solicitação conforme o convidado
-- ---------------------------------------------------------------------
create or replace function public.guests_sync_transport()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.merged_into_id is null and new.mode <> 'online' and new.transport = 'precisa_transporte' then
    insert into public.transport_requests (event_id, guest_id)
    values (new.event_id, new.id)
    on conflict (guest_id) do update set cancelled_at = null;
  else
    update public.transport_requests set cancelled_at = coalesce(cancelled_at, now())
    where guest_id = new.id and cancelled_at is null;
  end if;
  return null;
end;
$$;

create trigger guests_sync_transport after insert or update of mode, transport, merged_into_id on public.guests
  for each row execute function public.guests_sync_transport();

-- ---------------------------------------------------------------------
-- Crédito: as colunas church_id/group_id/member_id de guests espelham a indicação principal
-- ---------------------------------------------------------------------
create or replace function private.sync_guest_credit(p_guest_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  select member_id, church_id, group_id into r
  from public.guest_referrals where guest_id = p_guest_id and is_primary;
  if found then
    update public.guests set church_id = r.church_id, group_id = r.group_id, member_id = r.member_id
    where id = p_guest_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Detecção de duplicidade: telefone (do convidado ou do responsável) + similaridade de nome
-- ---------------------------------------------------------------------
create or replace function private.detect_guest_duplicates(p_guest_id uuid)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.guests%rowtype;
  v_count int := 0;
  c record;
begin
  select * into g from public.guests where id = p_guest_id;
  if not found or g.merged_into_id is not null or g.anonymized_at is not null then
    return 0;
  end if;
  for c in
    select o.id,
      extensions.similarity(o.name_normalized, g.name_normalized) as sim,
      (coalesce(o.phone_normalized, o.guardian_phone) = coalesce(g.phone_normalized, g.guardian_phone)) as same_phone
    from public.guests o
    where o.event_id = g.event_id
      and o.id <> g.id
      and o.merged_into_id is null
      and o.anonymized_at is null
      and (
        coalesce(o.phone_normalized, o.guardian_phone) = coalesce(g.phone_normalized, g.guardian_phone)
        or extensions.similarity(o.name_normalized, g.name_normalized) >= 0.8
      )
  loop
    insert into public.duplicate_reviews (event_id, guest_id, candidate_guest_id, church_id, similarity, reason)
    values (
      g.event_id, g.id, c.id, g.church_id, c.sim,
      case
        when c.same_phone and c.sim >= 0.5 then 'Mesmo telefone e nome parecido'
        when c.same_phone then 'Mesmo telefone, nome diferente (pode ser da mesma família)'
        else 'Nome muito parecido'
      end
    )
    on conflict do nothing;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;
  update public.guests g2 set possible_duplicate = exists (
    select 1 from public.duplicate_reviews d
    where d.status = 'pendente' and (d.guest_id = g2.id or d.candidate_guest_id = g2.id)
  )
  where g2.id = g.id or g2.id in (
    select candidate_guest_id from public.duplicate_reviews where guest_id = g.id
    union select guest_id from public.duplicate_reviews where candidate_guest_id = g.id
  );
  return v_count;
end;
$$;

-- Reavalia quando nome ou telefone mudam.
create or replace function public.guests_redetect_duplicates()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.detect_guest_duplicates(new.id);
  return null;
end;
$$;

create trigger guests_redetect_duplicates after update of full_name, phone_normalized, guardian_phone on public.guests
  for each row when (new.merged_into_id is null)
  execute function public.guests_redetect_duplicates();

-- ---------------------------------------------------------------------
-- RPC: cadastrar convidado a partir de um membro
-- ---------------------------------------------------------------------
create or replace function public.create_guest(
  p_member_id uuid,
  p_full_name text,
  p_phone text,
  p_category public.guest_category,
  p_consent boolean,
  p_mode public.participation_mode default 'indefinido',
  p_transport public.transport_need default 'indefinido',
  p_invite_status public.invite_status default 'nao_contatado',
  p_is_authority boolean default false,
  p_is_other_church_pastor boolean default false,
  p_notes text default null,
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_event_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event uuid := coalesce(p_event_id, private.active_event_id());
  v_member record;
  v_phone text;
  v_guardian_phone text;
  v_minor boolean := p_category in ('crianca', 'adolescente');
  v_guest_id uuid;
  v_dups int;
  v_user uuid := private.current_profile_id();
begin
  if v_event is null then
    raise exception 'Nenhum evento ativo. Peça ao Administrador do Polo para ativar o evento em Configurações.'
      using errcode = 'P0001';
  end if;
  if not private.event_is_open(v_event) then
    raise exception 'Esta edição do evento está encerrada (somente leitura).' using errcode = 'P0001';
  end if;
  select id, church_id, group_id, active into v_member from public.members where id = p_member_id;
  if not found then
    raise exception 'Membro não encontrado.' using errcode = 'P0001';
  end if;
  if not (private.has_church_access(v_member.church_id) or v_member.group_id = any (private.my_led_group_ids())) then
    raise exception 'Você não tem permissão para cadastrar convidados deste membro.' using errcode = '42501';
  end if;
  if not v_member.active then
    raise exception 'Este membro está inativo. Os convites já feitos continuam valendo, mas não é possível cadastrar novos.'
      using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_full_name, ''))) < 3 then
    raise exception 'Informe o nome completo do convidado.' using errcode = 'P0001';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'É obrigatório registrar o consentimento %.',
      case when v_minor then 'do responsável legal' else 'do convidado' end using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is not null then
    v_phone := public.normalize_phone(p_phone);
    if v_phone is null then
      raise exception 'Telefone inválido. Use DDD + número, ex.: (83) 98765-4321.' using errcode = 'P0001';
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
  if p_notes is not null and length(p_notes) > 500 then
    raise exception 'As observações podem ter no máximo 500 caracteres.' using errcode = 'P0001';
  end if;

  insert into public.guests (
    event_id, full_name, phone_normalized, category, is_authority, is_other_church_pastor, mode, transport,
    invite_status, notes, guardian_name, guardian_phone, church_id, group_id, member_id, created_by, updated_by
  ) values (
    v_event, p_full_name, v_phone, p_category, coalesce(p_is_authority, false),
    coalesce(p_is_other_church_pastor, false), coalesce(p_mode, 'indefinido'), p_transport,
    coalesce(p_invite_status, 'nao_contatado'), p_notes,
    case when v_minor then trim(p_guardian_name) end, v_guardian_phone,
    v_member.church_id, v_member.group_id, v_member.id, v_user, v_user
  ) returning id into v_guest_id;

  -- Snapshot do vínculo (seção 8): trocas futuras de grupo não alteram este registro.
  insert into public.guest_referrals (guest_id, event_id, member_id, church_id, group_id, is_primary, created_by)
  values (v_guest_id, v_event, v_member.id, v_member.church_id, v_member.group_id, true, v_user);

  insert into public.guest_consents (guest_id, consent_text, given_by_guardian, guardian_name, recorded_by)
  values (v_guest_id, private.consent_text(v_minor), v_minor,
          case when v_minor then trim(p_guardian_name) end, v_user);

  v_dups := private.detect_guest_duplicates(v_guest_id);
  return jsonb_build_object('id', v_guest_id, 'possible_duplicate', v_dups > 0, 'duplicates', v_dups);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: marcar como pessoas diferentes
-- ---------------------------------------------------------------------
create or replace function public.resolve_duplicate_distinct(p_review_id uuid, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  d record;
begin
  select * into d from public.duplicate_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Revisão não encontrada.' using errcode = 'P0001';
  end if;
  if not private.has_church_access(d.church_id) then
    raise exception 'Você não tem permissão para revisar esta duplicidade.' using errcode = '42501';
  end if;
  if d.status <> 'pendente' then
    raise exception 'Esta revisão já foi resolvida.' using errcode = 'P0001';
  end if;
  update public.duplicate_reviews
  set status = 'pessoas_diferentes', resolution_note = left(p_note, 500),
      resolved_by = private.current_profile_id(), resolved_at = now()
  where id = p_review_id;
  update public.guests g set possible_duplicate = exists (
    select 1 from public.duplicate_reviews r
    where r.status = 'pendente' and (r.guest_id = g.id or r.candidate_guest_id = g.id)
  ) where g.id in (d.guest_id, d.candidate_guest_id);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: mesclar duplicidade. Mantém p_keep_guest_id; o crédito fica com o PRIMEIRO cadastro.
-- ---------------------------------------------------------------------
create or replace function public.merge_guests(p_review_id uuid, p_keep_guest_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  d record;
  v_keep public.guests%rowtype;
  v_drop public.guests%rowtype;
  v_drop_id uuid;
  v_first_ref uuid;
  a record;
begin
  select * into d from public.duplicate_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Revisão não encontrada.' using errcode = 'P0001';
  end if;
  if d.status <> 'pendente' then
    raise exception 'Esta revisão já foi resolvida.' using errcode = 'P0001';
  end if;
  if p_keep_guest_id not in (d.guest_id, d.candidate_guest_id) then
    raise exception 'O registro mantido precisa ser um dos dois da revisão.' using errcode = 'P0001';
  end if;
  v_drop_id := case when p_keep_guest_id = d.guest_id then d.candidate_guest_id else d.guest_id end;
  select * into v_keep from public.guests where id = p_keep_guest_id for update;
  select * into v_drop from public.guests where id = v_drop_id for update;
  if not (private.has_church_access(v_keep.church_id) and private.has_church_access(v_drop.church_id)) then
    raise exception 'Para mesclar, você precisa ter acesso às igrejas dos dois registros.' using errcode = '42501';
  end if;
  if not private.event_is_open(v_keep.event_id) then
    raise exception 'Esta edição do evento está encerrada (somente leitura).' using errcode = 'P0001';
  end if;
  if v_keep.merged_into_id is not null or v_drop.merged_into_id is not null then
    raise exception 'Um dos registros já foi mesclado.' using errcode = 'P0001';
  end if;

  -- Indicações do registro descartado passam para o mantido (histórico preservado).
  update public.guest_referrals set is_primary = false where guest_id in (v_keep.id, v_drop.id);
  update public.guest_referrals set guest_id = v_keep.id where guest_id = v_drop.id;
  -- Regra de crédito: a indicação mais antiga é a principal.
  select id into v_first_ref from public.guest_referrals
  where guest_id = v_keep.id order by created_at, id limit 1;
  update public.guest_referrals set is_primary = true where id = v_first_ref;

  update public.guest_consents set guest_id = v_keep.id where guest_id = v_drop.id;

  -- Presenças: se ambos têm presença ativa do mesmo tipo, mantém a mais antiga.
  for a in select * from public.attendances where guest_id = v_drop.id and revoked_at is null loop
    if exists (select 1 from public.attendances x where x.guest_id = v_keep.id and x.type = a.type
               and x.revoked_at is null and x.checked_in_at <= a.checked_in_at) then
      update public.attendances set revoked_at = now(), revoked_by = private.current_profile_id(),
        revoke_reason = 'Mesclado: presença duplicada' where id = a.id;
    else
      update public.attendances set revoked_at = now(), revoked_by = private.current_profile_id(),
        revoke_reason = 'Mesclado: presença duplicada'
      where guest_id = v_keep.id and type = a.type and revoked_at is null;
    end if;
  end loop;
  update public.attendances set guest_id = v_keep.id where guest_id = v_drop.id;

  -- Completa dados ausentes do registro mantido.
  update public.guests set
    phone_normalized = coalesce(v_keep.phone_normalized, v_drop.phone_normalized),
    notes = coalesce(v_keep.notes, v_drop.notes),
    is_authority = v_keep.is_authority or v_drop.is_authority,
    is_other_church_pastor = v_keep.is_other_church_pastor or v_drop.is_other_church_pastor,
    transport = case when v_keep.mode = 'online' then null
                     when v_keep.transport = 'indefinido' and v_drop.mode <> 'online' then v_drop.transport
                     else v_keep.transport end,
    updated_by = private.current_profile_id()
  where id = v_keep.id;

  update public.guests set merged_into_id = v_keep.id, possible_duplicate = false,
    updated_by = private.current_profile_id()
  where id = v_drop.id;
  perform private.sync_guest_credit(v_keep.id);

  update public.duplicate_reviews set status = 'mesclado', resolution_note = left(p_note, 500),
    resolved_by = private.current_profile_id(), resolved_at = now()
  where id = p_review_id;
  -- Outras revisões pendentes do registro descartado deixam de fazer sentido.
  update public.duplicate_reviews set status = 'mesclado', resolved_by = private.current_profile_id(),
    resolved_at = now(), resolution_note = 'Resolvida pela mescla de outra revisão'
  where status = 'pendente' and (guest_id = v_drop.id or candidate_guest_id = v_drop.id);
  update public.guests g set possible_duplicate = exists (
    select 1 from public.duplicate_reviews r
    where r.status = 'pendente' and (r.guest_id = g.id or r.candidate_guest_id = g.id)
  ) where g.id = v_keep.id;

  perform public.write_audit('duplicidade.mesclar', 'guests', v_keep.id::text, v_keep.church_id,
    jsonb_build_object('descartado', v_drop.id, 'revisao', p_review_id),
    jsonb_build_object('mantido', v_keep.id, 'observacao', p_note));
  return jsonb_build_object('kept', v_keep.id, 'merged', v_drop.id);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: reatribuir crédito manualmente (com justificativa auditada)
-- ---------------------------------------------------------------------
create or replace function public.reassign_guest_credit(p_guest_id uuid, p_member_id uuid, p_justification text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  g record;
  m record;
  v_ref uuid;
  v_old jsonb;
begin
  if length(trim(coalesce(p_justification, ''))) < 10 then
    raise exception 'Informe uma justificativa (mínimo de 10 caracteres).' using errcode = 'P0001';
  end if;
  select id, event_id, church_id, group_id, member_id, merged_into_id into g from public.guests where id = p_guest_id;
  if not found or g.merged_into_id is not null then
    raise exception 'Convidado não encontrado.' using errcode = 'P0001';
  end if;
  select id, church_id, group_id into m from public.members where id = p_member_id;
  if not found then
    raise exception 'Membro não encontrado.' using errcode = 'P0001';
  end if;
  if not (private.has_church_access(g.church_id) and private.has_church_access(m.church_id)) then
    raise exception 'Somente o Gestor das igrejas envolvidas ou o Administrador pode reatribuir o crédito.'
      using errcode = '42501';
  end if;
  if not private.event_is_open(g.event_id) then
    raise exception 'Esta edição do evento está encerrada (somente leitura).' using errcode = 'P0001';
  end if;
  v_old := jsonb_build_object('member_id', g.member_id, 'church_id', g.church_id, 'group_id', g.group_id);
  update public.guest_referrals set is_primary = false where guest_id = p_guest_id;
  select id into v_ref from public.guest_referrals where guest_id = p_guest_id and member_id = p_member_id
    order by created_at limit 1;
  if v_ref is null then
    insert into public.guest_referrals (guest_id, event_id, member_id, church_id, group_id, is_primary, created_by)
    values (p_guest_id, g.event_id, m.id, m.church_id, m.group_id, true, private.current_profile_id())
    returning id into v_ref;
  else
    update public.guest_referrals set is_primary = true where id = v_ref;
  end if;
  perform private.sync_guest_credit(p_guest_id);
  perform public.write_audit('credito.reatribuir', 'guests', p_guest_id::text, m.church_id, v_old,
    jsonb_build_object('member_id', m.id, 'church_id', m.church_id, 'group_id', m.group_id,
                       'justificativa', trim(p_justification)));
end;
$$;

-- ---------------------------------------------------------------------
-- Lista de revisões com os dois registros lado a lado (somente quem pode revisar)
-- ---------------------------------------------------------------------
create or replace function public.list_duplicate_reviews(p_event_id uuid default null, p_status public.duplicate_status default 'pendente')
returns table (
  id uuid, status public.duplicate_status, reason text, similarity real, created_at timestamptz,
  church_id uuid, resolution_note text,
  a_id uuid, a_name text, a_phone text, a_category public.guest_category, a_created_at timestamptz,
  a_member text, a_group text, a_church text,
  b_id uuid, b_name text, b_phone text, b_category public.guest_category, b_created_at timestamptz,
  b_member text, b_group text, b_church text
)
language sql stable security definer
set search_path = ''
as $$
  select d.id, d.status, d.reason, d.similarity, d.created_at, d.church_id, d.resolution_note,
    a.id, a.full_name, coalesce(a.phone_normalized, a.guardian_phone), a.category, a.created_at,
    ma.full_name, ga.name, ca.name,
    b.id, b.full_name, coalesce(b.phone_normalized, b.guardian_phone), b.category, b.created_at,
    mb.full_name, gb.name, cb.name
  from public.duplicate_reviews d
  join public.guests a on a.id = d.guest_id
  join public.guests b on b.id = d.candidate_guest_id
  join public.churches ca on ca.id = a.church_id
  join public.churches cb on cb.id = b.church_id
  left join public.members ma on ma.id = a.member_id
  left join public.members mb on mb.id = b.member_id
  left join public.assistance_groups ga on ga.id = a.group_id
  left join public.assistance_groups gb on gb.id = b.group_id
  where d.event_id = coalesce(p_event_id, private.active_event_id())
    and (p_status is null or d.status = p_status)
    and d.church_id = any (private.my_managed_church_ids())
  order by d.created_at desc;
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.create_guest(uuid, text, text, public.guest_category, boolean,
  public.participation_mode, public.transport_need, public.invite_status, boolean, boolean, text, text, text, uuid)
  from public, anon;
grant execute on function public.create_guest(uuid, text, text, public.guest_category, boolean,
  public.participation_mode, public.transport_need, public.invite_status, boolean, boolean, text, text, text, uuid)
  to authenticated;
revoke execute on function public.resolve_duplicate_distinct(uuid, text) from public, anon;
grant execute on function public.resolve_duplicate_distinct(uuid, text) to authenticated;
revoke execute on function public.merge_guests(uuid, uuid, text) from public, anon;
grant execute on function public.merge_guests(uuid, uuid, text) to authenticated;
revoke execute on function public.reassign_guest_credit(uuid, uuid, text) from public, anon;
grant execute on function public.reassign_guest_credit(uuid, uuid, text) to authenticated;
revoke execute on function public.list_duplicate_reviews(uuid, public.duplicate_status) from public, anon;
grant execute on function public.list_duplicate_reviews(uuid, public.duplicate_status) to authenticated;
revoke execute on function public.guests_before_write() from public, anon, authenticated;
revoke execute on function public.guests_sync_transport() from public, anon, authenticated;
revoke execute on function public.guests_redetect_duplicates() from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
