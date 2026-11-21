-- =====================================================================
-- Fase 2 — Auditoria por gatilhos (seção 15)
-- =====================================================================

-- IP do cliente quando disponível (cabeçalho repassado pelo PostgREST).
create or replace function public.request_ip()
returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_headers json;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  return nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1), '');
exception when others then
  return null;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.profiles where id = auth.uid();
$$;

-- Registro manual (usado por RPCs: exportações, anonimização, reatribuição de crédito).
create or replace function public.write_audit(
  p_action text, p_table text, p_record_id text, p_church_id uuid, p_old jsonb, p_new jsonb
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (user_id, action, table_name, record_id, church_id, old_data, new_data, ip)
  values (public.current_profile_id(), p_action, p_table, p_record_id, p_church_id, p_old, p_new, public.request_ip());
end;
$$;
revoke all on function public.write_audit(text, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;

-- Gatilho genérico. Ação = nome da tabela + operação, ou um rótulo passado como argumento.
create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
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
  values (public.current_profile_id(), v_action, tg_table_name, v_row ->> 'id', v_church, v_old, v_new,
          public.request_ip());
  return null;
end;
$$;

create trigger audit_guests after insert or update or delete on public.guests
  for each row execute function public.audit_trigger();
create trigger audit_attendances after insert or update or delete on public.attendances
  for each row execute function public.audit_trigger();
create trigger audit_guest_referrals after insert or update or delete on public.guest_referrals
  for each row execute function public.audit_trigger();
create trigger audit_duplicate_reviews after update on public.duplicate_reviews
  for each row execute function public.audit_trigger();
create trigger audit_events after insert or update or delete on public.events
  for each row execute function public.audit_trigger();
create trigger audit_event_settings after update on public.event_settings
  for each row execute function public.audit_trigger();
create trigger audit_role_assignments after insert or update or delete on public.role_assignments
  for each row execute function public.audit_trigger();
create trigger audit_profiles after update of active on public.profiles
  for each row execute function public.audit_trigger();
