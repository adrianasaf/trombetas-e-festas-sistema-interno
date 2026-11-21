-- =====================================================================
-- Fase 2 — Funções auxiliares de usuários
-- =====================================================================

-- Usada apenas pela Edge Function convidar-usuario (service_role).
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

-- Funções de escopo podem ser chamadas por usuários autenticados (retornam apenas
-- informações sobre o próprio usuário), mas não por visitantes anônimos.
revoke execute on function public.has_any_role() from public, anon;
revoke execute on function public.has_role(public.app_role) from public, anon;
revoke execute on function public.is_polo_admin() from public, anon;
revoke execute on function public.my_managed_church_ids() from public, anon;
revoke execute on function public.my_led_group_ids() from public, anon;
revoke execute on function public.my_stats_church_ids() from public, anon;
revoke execute on function public.can_view_polo_stats() from public, anon;
revoke execute on function public.has_church_access(uuid) from public, anon;
revoke execute on function public.has_group_access(uuid) from public, anon;
revoke execute on function public.has_record_access(uuid, uuid) from public, anon;
revoke execute on function public.can_check_in() from public, anon;
revoke execute on function public.event_is_open(uuid) from public, anon;
revoke execute on function public.active_event_id() from public, anon;
revoke execute on function public.can_manage_user(uuid) from public, anon;
revoke execute on function public.can_grant_role(public.app_role, uuid, uuid) from public, anon;
revoke execute on function public.current_profile_id() from public, anon;
grant execute on function
  public.has_any_role(), public.has_role(public.app_role), public.is_polo_admin(),
  public.my_managed_church_ids(), public.my_led_group_ids(), public.my_stats_church_ids(),
  public.can_view_polo_stats(), public.has_church_access(uuid), public.has_group_access(uuid),
  public.has_record_access(uuid, uuid), public.can_check_in(), public.event_is_open(uuid),
  public.active_event_id(), public.can_manage_user(uuid), public.can_grant_role(public.app_role, uuid, uuid),
  public.current_profile_id()
  to authenticated;

-- Funções de gatilho não devem ser chamadas diretamente pela API.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_email_change() from public, anon, authenticated;
revoke execute on function public.audit_trigger() from public, anon, authenticated;
revoke execute on function public.members_before_write() from public, anon, authenticated;
revoke execute on function public.members_after_write() from public, anon, authenticated;
revoke execute on function public.events_after_insert() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.guard_last_admin() from public, anon, authenticated;

-- Lista de usuários visíveis para a tela "Usuários e permissões".
create or replace function public.list_manageable_users()
returns table (
  id uuid, full_name text, email text, active boolean, last_sign_in_at timestamptz, invited_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email, p.active, u.last_sign_in_at, u.invited_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.can_manage_user(p.id)
  order by p.full_name, p.email;
$$;
revoke execute on function public.list_manageable_users() from public, anon;
grant execute on function public.list_manageable_users() to authenticated;
