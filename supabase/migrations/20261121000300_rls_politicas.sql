-- =====================================================================
-- Fase 2 — Row Level Security em TODAS as tabelas
-- Ausência de política para uma operação = operação negada.
-- Escritas sensíveis (convidados, presenças, mesclas, snapshots) passam por RPCs
-- security definer que validam o escopo; por isso algumas tabelas não têm
-- política de insert/update/delete para o papel authenticated.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.churches enable row level security;
alter table public.assistance_groups enable row level security;
alter table public.members enable row level security;
alter table public.member_group_history enable row level security;
alter table public.role_assignments enable row level security;
alter table public.events enable row level security;
alter table public.event_settings enable row level security;
alter table public.guests enable row level security;
alter table public.guest_referrals enable row level security;
alter table public.guest_consents enable row level security;
alter table public.duplicate_reviews enable row level security;
alter table public.attendances enable row level security;
alter table public.transport_requests enable row level security;
alter table public.goal_snapshots enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

-- Visitantes anônimos não acessam nenhuma tabela.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
-- Colunas que o cliente nunca grava diretamente
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.app_settings from authenticated;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_manage_user(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_polo_admin()))
  with check (id = (select auth.uid()) or (select public.is_polo_admin()));
-- Perfis são criados pelo gatilho do Auth e removidos junto com o usuário do Auth.

-- ---------------------------------------------------------------------
-- churches — leitura para qualquer usuário com perfil; escrita só Admin; sem exclusão
-- ---------------------------------------------------------------------
create policy churches_select on public.churches for select to authenticated
  using ((select public.has_any_role()));
create policy churches_insert on public.churches for insert to authenticated
  with check ((select public.is_polo_admin()));
create policy churches_update on public.churches for update to authenticated
  using ((select public.is_polo_admin())) with check ((select public.is_polo_admin()));

-- ---------------------------------------------------------------------
-- assistance_groups — Gestor da igreja ou Admin escrevem
-- ---------------------------------------------------------------------
create policy assistance_groups_select on public.assistance_groups for select to authenticated
  using ((select public.has_any_role()));
create policy assistance_groups_insert on public.assistance_groups for insert to authenticated
  with check (church_id = any ((select public.my_managed_church_ids())::uuid[]));
create policy assistance_groups_update on public.assistance_groups for update to authenticated
  using (church_id = any ((select public.my_managed_church_ids())::uuid[]))
  with check (church_id = any ((select public.my_managed_church_ids())::uuid[]));
create policy assistance_groups_delete on public.assistance_groups for delete to authenticated
  using (church_id = any ((select public.my_managed_church_ids())::uuid[]));

-- ---------------------------------------------------------------------
-- members — Admin, Gestor da igreja, Responsável do grupo
-- ---------------------------------------------------------------------
create policy members_select on public.members for select to authenticated
  using (
    church_id = any ((select public.my_managed_church_ids())::uuid[])
    or group_id = any ((select public.my_led_group_ids())::uuid[])
  );
create policy members_insert on public.members for insert to authenticated
  with check (public.has_group_access(group_id));
create policy members_update on public.members for update to authenticated
  using (
    church_id = any ((select public.my_managed_church_ids())::uuid[])
    or group_id = any ((select public.my_led_group_ids())::uuid[])
  )
  with check (public.has_group_access(group_id));
create policy members_delete on public.members for delete to authenticated
  using (public.has_group_access(group_id));

create policy member_group_history_select on public.member_group_history for select to authenticated
  using (exists (select 1 from public.members m where m.id = member_id));

-- ---------------------------------------------------------------------
-- role_assignments
-- ---------------------------------------------------------------------
create policy role_assignments_select on public.role_assignments for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_user(user_id));
create policy role_assignments_insert on public.role_assignments for insert to authenticated
  with check (public.can_grant_role(role, church_id, group_id) and created_by = (select auth.uid()));
create policy role_assignments_delete on public.role_assignments for delete to authenticated
  using (public.can_grant_role(role, church_id, group_id) and user_id <> (select auth.uid()));

-- ---------------------------------------------------------------------
-- events / event_settings — leitura geral; escrita só Admin
-- ---------------------------------------------------------------------
create policy events_select on public.events for select to authenticated
  using ((select public.has_any_role()));
create policy events_insert on public.events for insert to authenticated
  with check ((select public.is_polo_admin()));
create policy events_update on public.events for update to authenticated
  using ((select public.is_polo_admin())) with check ((select public.is_polo_admin()));
create policy events_delete on public.events for delete to authenticated
  using ((select public.is_polo_admin()) and status = 'planejamento');

create policy event_settings_select on public.event_settings for select to authenticated
  using ((select public.has_any_role()));
create policy event_settings_update on public.event_settings for update to authenticated
  using ((select public.is_polo_admin())) with check ((select public.is_polo_admin()));

-- ---------------------------------------------------------------------
-- guests — dados pessoais: Admin, Gestor da igreja do crédito, Responsável do grupo do crédito.
-- Recepção e Leitor NÃO têm select direto: usam RPCs com telefone mascarado/agregados.
-- Inserção somente via RPC create_guest (Fase 4).
-- ---------------------------------------------------------------------
create policy guests_select on public.guests for select to authenticated
  using (
    church_id = any ((select public.my_managed_church_ids())::uuid[])
    or group_id = any ((select public.my_led_group_ids())::uuid[])
  );
create policy guests_update on public.guests for update to authenticated
  using (
    (church_id = any ((select public.my_managed_church_ids())::uuid[])
      or group_id = any ((select public.my_led_group_ids())::uuid[]))
    and public.event_is_open(event_id)
  )
  with check (
    (church_id = any ((select public.my_managed_church_ids())::uuid[])
      or group_id = any ((select public.my_led_group_ids())::uuid[]))
    and public.event_is_open(event_id)
  );
create policy guests_delete on public.guests for delete to authenticated
  using (
    (church_id = any ((select public.my_managed_church_ids())::uuid[])
      or group_id = any ((select public.my_led_group_ids())::uuid[]))
    and public.event_is_open(event_id)
  );

create policy guest_referrals_select on public.guest_referrals for select to authenticated
  using (
    church_id = any ((select public.my_managed_church_ids())::uuid[])
    or group_id = any ((select public.my_led_group_ids())::uuid[])
    or exists (select 1 from public.guests g where g.id = guest_id)
  );

create policy guest_consents_select on public.guest_consents for select to authenticated
  using (exists (select 1 from public.guests g where g.id = guest_id));

create policy duplicate_reviews_select on public.duplicate_reviews for select to authenticated
  using (church_id = any ((select public.my_managed_church_ids())::uuid[]));

-- ---------------------------------------------------------------------
-- attendances — leitura acompanha a visibilidade do convidado; escrita só via RPC
-- ---------------------------------------------------------------------
create policy attendances_select on public.attendances for select to authenticated
  using (exists (select 1 from public.guests g where g.id = guest_id));

-- ---------------------------------------------------------------------
-- transport_requests — criadas por gatilho; atualização no escopo do convidado
-- ---------------------------------------------------------------------
create policy transport_requests_select on public.transport_requests for select to authenticated
  using (exists (select 1 from public.guests g where g.id = guest_id));
create policy transport_requests_update on public.transport_requests for update to authenticated
  using (exists (select 1 from public.guests g where g.id = guest_id) and public.event_is_open(event_id))
  with check (exists (select 1 from public.guests g where g.id = guest_id) and public.event_is_open(event_id));

-- ---------------------------------------------------------------------
-- goal_snapshots — leitura no escopo; escrita só via função de corte
-- ---------------------------------------------------------------------
create policy goal_snapshots_select on public.goal_snapshots for select to authenticated
  using (
    church_id = any ((select public.my_managed_church_ids())::uuid[])
    or group_id = any ((select public.my_led_group_ids())::uuid[])
  );

-- ---------------------------------------------------------------------
-- audit_logs — Admin vê tudo; Gestor vê a da sua igreja (não basta "todas" do Admin)
-- ---------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select public.is_polo_admin()) or church_id = any ((select public.my_managed_church_ids())::uuid[]));

create policy app_settings_select on public.app_settings for select to authenticated
  using ((select public.is_polo_admin()));

-- Atualização restrita por coluna: crédito (igreja/grupo/membro), evento e carimbos
-- só mudam por RPCs security definer ou gatilhos. (Revogar coluna não basta quando
-- há grant na tabela inteira; por isso revogamos o UPDATE da tabela e concedemos colunas.)
revoke update on public.guests, public.members, public.transport_requests, public.profiles,
  public.role_assignments, public.attendances, public.guest_referrals, public.guest_consents,
  public.duplicate_reviews, public.goal_snapshots, public.member_group_history
  from authenticated;
grant update (full_name, phone_normalized, category, is_authority, is_other_church_pastor, mode, transport,
  invite_status, notes, guardian_name, guardian_phone, updated_by) on public.guests to authenticated;
grant update (full_name, group_id, phone_normalized, active, joined_at, inactivated_at)
  on public.members to authenticated;
grant update (status, driver_name, pickup_point, notes, updated_by) on public.transport_requests to authenticated;
grant update (full_name, active) on public.profiles to authenticated;
-- Tabelas escritas apenas por RPC/gatilho: sem insert/delete direto.
revoke insert, delete on public.attendances, public.guest_referrals, public.guest_consents,
  public.duplicate_reviews, public.goal_snapshots, public.member_group_history, public.transport_requests,
  public.profiles, public.guests
  from authenticated;
grant delete on public.guests to authenticated;
