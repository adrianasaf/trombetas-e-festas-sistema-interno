-- =====================================================================
-- VIRADA PARA PRODUÇÃO (executado uma única vez em 22/11/2026 no projeto zaawhfbmuogfyigxscta).
-- Remove SOMENTE dados de teste e de demonstração; mantém tudo que foi cadastrado por pessoas reais.
-- Mantidos: 11 igrejas, usuários reais (não @teste.trombetas.dev) e seus perfis, grupos que não são
-- "Grupo Demo %" nem "[TESTE RLS]%", auditoria das ações de usuários reais, configurações.
-- =====================================================================
begin;

create temporary table contagem (tabela text primary key, antes bigint, depois bigint) on commit drop;
insert into contagem (tabela, antes) values
  ('auth.users', (select count(*) from auth.users)),
  ('events', (select count(*) from public.events)),
  ('attendances', (select count(*) from public.attendances)),
  ('transport_requests', (select count(*) from public.transport_requests)),
  ('duplicate_reviews', (select count(*) from public.duplicate_reviews)),
  ('guest_consents', (select count(*) from public.guest_consents)),
  ('guest_referrals', (select count(*) from public.guest_referrals)),
  ('guests', (select count(*) from public.guests)),
  ('goal_snapshots', (select count(*) from public.goal_snapshots)),
  ('member_group_history', (select count(*) from public.member_group_history)),
  ('members', (select count(*) from public.members)),
  ('assistance_groups', (select count(*) from public.assistance_groups)),
  ('role_assignments', (select count(*) from public.role_assignments)),
  ('audit_logs', (select count(*) from public.audit_logs)),
  ('churches', (select count(*) from public.churches));

-- Usuários reais (mantidos) e dados de teste/demonstração
create temporary table reais on commit drop as
  select id from auth.users where email not like '%@teste.trombetas.dev';
create temporary table grupos_demo on commit drop as
  select id from public.assistance_groups where name like 'Grupo Demo %' or name like '[TESTE RLS]%';
-- Convidados de demonstração/teste = os que NÃO foram criados por usuário real
create temporary table convidados_demo on commit drop as
  select id from public.guests where created_by is null or created_by not in (select id from reais);

-- Segurança: aborta se algum dado real depender de dado de demonstração.
do $$
begin
  if exists (select 1 from public.members where created_by in (select id from reais) and group_id in (select id from grupos_demo))
     or exists (select 1 from public.guests g where g.id not in (select id from convidados_demo)
                and (g.group_id in (select id from grupos_demo) or g.merged_into_id in (select id from convidados_demo)))
     or exists (select 1 from public.guest_referrals r where r.guest_id not in (select id from convidados_demo)
                and r.group_id in (select id from grupos_demo))
     or exists (select 1 from public.attendances a where a.guest_id in (select id from convidados_demo)
                and a.checked_in_by in (select id from reais)) then
    raise exception 'Há dados reais ligados a dados de demonstração. Virada abortada.';
  end if;
end $$;

-- Desativa só a auditoria durante a limpeza (FKs e demais regras continuam ativas)
alter table public.guests disable trigger audit_guests;
alter table public.attendances disable trigger audit_attendances;
alter table public.guest_referrals disable trigger audit_guest_referrals;
alter table public.duplicate_reviews disable trigger audit_duplicate_reviews;
alter table public.events disable trigger audit_events;
alter table public.event_settings disable trigger audit_event_settings;
alter table public.role_assignments disable trigger audit_role_assignments;
alter table public.profiles disable trigger audit_profiles;
alter table public.transport_requests disable trigger audit_transport_requests;

delete from public.attendances where guest_id in (select id from convidados_demo);
delete from public.duplicate_reviews where guest_id in (select id from convidados_demo)
  or candidate_guest_id in (select id from convidados_demo);
delete from public.transport_requests where guest_id in (select id from convidados_demo);
delete from public.guest_consents where guest_id in (select id from convidados_demo);
delete from public.guest_referrals where guest_id in (select id from convidados_demo);
update public.guests set merged_into_id = null where id in (select id from convidados_demo) and merged_into_id is not null;
delete from public.guests where id in (select id from convidados_demo);
delete from public.goal_snapshots;
delete from public.members where group_id in (select id from grupos_demo);
delete from public.assistance_groups where id in (select id from grupos_demo);
-- Usuários de teste (perfis e atribuições saem em cascata)
delete from auth.users where email like '%@teste.trombetas.dev';
-- Evento: o evento atual vira o evento real (mantém o convidado real ligado a ele).
-- Se houver mais de um, os demais (de teste) são removidos.
delete from public.events where id <> (select id from public.events where status = 'ativo' limit 1)
  and not exists (select 1 from public.guests g where g.event_id = events.id);
update public.events set
  name = 'Trombetas e Festas 2026', year = 2026, status = 'ativo',
  starts_at = '2026-11-28 17:00:00-03', location = null, cutoff_at = null, snapshot_taken_at = null,
  invites_goal_per_member = 3, attendance_goal_per_member = 1
where status = 'ativo';

-- Auditoria: mantém só as ações de usuários reais
delete from public.audit_logs where user_id is null or user_id not in (select id from reais);

-- Ambiente: PRODUÇÃO
insert into public.app_settings (key, value) values ('environment', 'prod')
on conflict (key) do update set value = 'prod', updated_at = now();

alter table public.guests enable trigger audit_guests;
alter table public.attendances enable trigger audit_attendances;
alter table public.guest_referrals enable trigger audit_guest_referrals;
alter table public.duplicate_reviews enable trigger audit_duplicate_reviews;
alter table public.events enable trigger audit_events;
alter table public.event_settings enable trigger audit_event_settings;
alter table public.role_assignments enable trigger audit_role_assignments;
alter table public.profiles enable trigger audit_profiles;
alter table public.transport_requests enable trigger audit_transport_requests;

update contagem set depois = case tabela
  when 'auth.users' then (select count(*) from auth.users)
  when 'events' then (select count(*) from public.events)
  when 'attendances' then (select count(*) from public.attendances)
  when 'transport_requests' then (select count(*) from public.transport_requests)
  when 'duplicate_reviews' then (select count(*) from public.duplicate_reviews)
  when 'guest_consents' then (select count(*) from public.guest_consents)
  when 'guest_referrals' then (select count(*) from public.guest_referrals)
  when 'guests' then (select count(*) from public.guests)
  when 'goal_snapshots' then (select count(*) from public.goal_snapshots)
  when 'member_group_history' then (select count(*) from public.member_group_history)
  when 'members' then (select count(*) from public.members)
  when 'assistance_groups' then (select count(*) from public.assistance_groups)
  when 'role_assignments' then (select count(*) from public.role_assignments)
  when 'audit_logs' then (select count(*) from public.audit_logs)
  when 'churches' then (select count(*) from public.churches)
end;

select tabela, antes, depois from contagem order by tabela;
commit;
