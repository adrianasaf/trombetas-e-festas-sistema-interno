-- =====================================================================
-- Fase 9 — A anonimização também remove dados pessoais guardados na auditoria.
-- (audit_logs guarda o antes/depois de guests em JSON, incluindo nome e telefone.)
-- =====================================================================

create or replace function private.scrub_personal(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when p is null then null
    else p - 'full_name' - 'name_normalized' - 'phone_normalized' - 'guardian_name' - 'guardian_phone' - 'notes'
         || jsonb_build_object('dados_pessoais', 'removidos (LGPD)')
  end;
$$;

create or replace function private.anonymize_guest_row(p_guest_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.guests where id = p_guest_id or merged_into_id = p_guest_id;
  update public.guests set
    full_name = 'Convidado anonimizado ' || upper(left(replace(id::text, '-', ''), 8)),
    phone_normalized = null,
    guardian_name = null,
    guardian_phone = null,
    notes = null,
    anonymized_at = coalesce(anonymized_at, now())
  where id = any (v_ids);
  update public.guest_consents set guardian_name = null where guest_id = any (v_ids);
  update public.transport_requests set driver_name = null, pickup_point = null, notes = null
  where guest_id = any (v_ids);
  update public.duplicate_reviews set status = 'pessoas_diferentes', resolved_at = now(),
    resolution_note = 'Encerrada por anonimização (LGPD)'
  where status = 'pendente' and (guest_id = any (v_ids) or candidate_guest_id = any (v_ids));
  -- Auditoria: mantém o registro da operação, sem os dados pessoais.
  update public.audit_logs set old_data = private.scrub_personal(old_data), new_data = private.scrub_personal(new_data)
  where table_name = 'guests' and record_id = any (select x::text from unnest(v_ids) x);
end;
$$;

-- Exclusão a pedido do titular também limpa a auditoria daquele convidado.
create or replace function public.titular_request(p_guest_id uuid, p_action text, p_justification text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  g record;
  v_ids uuid[];
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
  select array_agg(id) into v_ids from public.guests where id = p_guest_id or merged_into_id = p_guest_id;
  if p_action = 'anonimizar' then
    perform private.anonymize_guest_row(p_guest_id);
  elsif p_action = 'excluir' then
    delete from public.attendances where guest_id = any (v_ids);
    delete from public.duplicate_reviews where guest_id = any (v_ids) or candidate_guest_id = any (v_ids);
    delete from public.guests where merged_into_id = p_guest_id;
    delete from public.guests where id = p_guest_id;
    update public.audit_logs set old_data = private.scrub_personal(old_data), new_data = private.scrub_personal(new_data)
    where table_name = 'guests' and record_id = any (select x::text from unnest(v_ids) x);
  else
    raise exception 'Ação inválida: use anonimizar ou excluir.' using errcode = '22023';
  end if;
  perform public.write_audit('lgpd.titular_' || p_action, 'guests', p_guest_id::text, g.church_id, null,
    jsonb_build_object('justificativa', trim(p_justification)));
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function public.titular_request(uuid, text, text) from public, anon;
grant execute on function public.titular_request(uuid, text, text) to authenticated;
