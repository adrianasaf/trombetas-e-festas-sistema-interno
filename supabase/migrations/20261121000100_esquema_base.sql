-- =====================================================================
-- Fase 2 — Esquema base: extensões, enums, utilitários e tabelas
-- Sistema de Gestão Trombetas e Festas (ICM Polo Torre)
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum ('polo_admin', 'church_manager', 'group_leader', 'reception', 'reader');
create type public.event_status as enum ('planejamento', 'ativo', 'encerrado');
create type public.guest_category as enum (
  'homem', 'mulher', 'crianca', 'adolescente', 'jovem_masculino', 'jovem_feminino'
);
create type public.participation_mode as enum ('presencial', 'online', 'indefinido');
create type public.transport_need as enum ('meios_proprios', 'precisa_transporte', 'indefinido');
create type public.invite_status as enum ('nao_contatado', 'convidado', 'confirmou', 'nao_comparecera');
create type public.attendance_type as enum ('presencial', 'online');
create type public.transport_status as enum ('pendente', 'organizado', 'concluido');
create type public.duplicate_status as enum ('pendente', 'mesclado', 'pessoas_diferentes');

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------

-- Normaliza telefone brasileiro para E.164. Mesma regra de src/lib/phone.ts.
create or replace function public.normalize_phone(p_input text, p_default_ddd text default '83')
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text;
  loc text;
begin
  if p_input is null then return null; end if;
  d := regexp_replace(p_input, '\D', '', 'g');
  if d = '' then return null; end if;
  if left(d, 2) = '00' then d := substr(d, 3); end if;
  if length(d) >= 12 and left(d, 2) = '55' then d := substr(d, 3); end if;
  if length(d) in (11, 12) and left(d, 1) = '0' then d := substr(d, 2); end if;
  if length(d) in (8, 9) then d := p_default_ddd || d; end if;
  if length(d) not in (10, 11) then return null; end if;
  if substr(d, 1, 1) = '0' or substr(d, 2, 1) = '0' then return null; end if;
  loc := substr(d, 3);
  if length(loc) = 9 and left(loc, 1) <> '9' then return null; end if;
  if length(loc) = 8 and left(loc, 1) not in ('2', '3', '4', '5') then return null; end if;
  return '+55' || d;
end;
$$;

-- Normaliza nome para comparação (minúsculas, sem acento, espaços simples).
create or replace function public.normalize_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(translate(coalesce(p_name, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g'));
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Cadastros permanentes
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 150),
  email text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  city text not null default '' check (length(city) <= 120),
  address text check (length(address) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index churches_name_key on public.churches (lower(name));

create table public.assistance_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 120),
  leader_name text not null default '' check (length(leader_name) <= 150),
  leader_user_id uuid references public.profiles (id) on delete set null,
  assistant_leader_name text check (length(assistant_leader_name) <= 150),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index assistance_groups_church_name_key on public.assistance_groups (church_id, lower(name));
create index assistance_groups_leader_user_id_idx on public.assistance_groups (leader_user_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 150),
  church_id uuid not null references public.churches (id) on delete restrict,
  group_id uuid not null references public.assistance_groups (id) on delete restrict,
  phone_normalized text check (phone_normalized ~ '^\+55[0-9]{10,11}$'),
  active boolean not null default true,
  joined_at date not null default current_date,
  inactivated_at date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint members_inactivation_check check (
    (active and inactivated_at is null) or (not active and inactivated_at is not null)
  )
);
create index members_church_id_idx on public.members (church_id);
create index members_group_id_idx on public.members (group_id);
create index members_created_by_idx on public.members (created_by);
create index members_name_trgm_idx on public.members using gin (full_name extensions.gin_trgm_ops);

create table public.member_group_history (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  from_group_id uuid references public.assistance_groups (id) on delete restrict,
  to_group_id uuid not null references public.assistance_groups (id) on delete restrict,
  from_church_id uuid references public.churches (id) on delete restrict,
  to_church_id uuid not null references public.churches (id) on delete restrict,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles (id) on delete set null
);
create index member_group_history_member_id_idx on public.member_group_history (member_id);
create index member_group_history_from_group_id_idx on public.member_group_history (from_group_id);
create index member_group_history_to_group_id_idx on public.member_group_history (to_group_id);
create index member_group_history_from_church_id_idx on public.member_group_history (from_church_id);
create index member_group_history_to_church_id_idx on public.member_group_history (to_church_id);
create index member_group_history_changed_by_idx on public.member_group_history (changed_by);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  church_id uuid references public.churches (id) on delete cascade,
  group_id uuid references public.assistance_groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint role_assignments_scope_check check (
    case role
      when 'polo_admin' then church_id is null and group_id is null
      when 'church_manager' then church_id is not null and group_id is null
      when 'group_leader' then group_id is not null
      when 'reception' then church_id is null and group_id is null
      when 'reader' then group_id is null
    end
  )
);
create unique index role_assignments_unique_key on public.role_assignments (
  user_id, role,
  coalesce(church_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index role_assignments_user_id_idx on public.role_assignments (user_id);
create index role_assignments_church_id_idx on public.role_assignments (church_id);
create index role_assignments_group_id_idx on public.role_assignments (group_id);
create index role_assignments_created_by_idx on public.role_assignments (created_by);

-- ---------------------------------------------------------------------
-- Edições do evento
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 150),
  year int not null check (year between 2000 and 2100),
  starts_at timestamptz,
  location text check (length(location) <= 300),
  stream_url text check (stream_url is null or stream_url ~* '^https?://'),
  logo_path text,
  invites_goal_per_member int not null default 3 check (invites_goal_per_member between 0 and 100),
  attendance_goal_per_member int not null default 1 check (attendance_goal_per_member between 0 and 100),
  cutoff_at timestamptz,
  snapshot_taken_at timestamptz,
  status public.event_status not null default 'planejamento',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Apenas um evento ativo por vez.
create unique index events_single_active_key on public.events ((true)) where status = 'ativo';

create table public.event_settings (
  event_id uuid primary key references public.events (id) on delete cascade,
  retention_days int not null default 180 check (retention_days between 1 and 3650),
  checkin_sound_enabled boolean not null default true,
  anonymized_at timestamptz,
  anonymized_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create index event_settings_anonymized_by_idx on public.event_settings (anonymized_by);
create index event_settings_updated_by_idx on public.event_settings (updated_by);

-- ---------------------------------------------------------------------
-- Convidados (pertencem a uma edição)
-- ---------------------------------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 2 and 150),
  name_normalized text generated always as (public.normalize_name(full_name)) stored,
  phone_normalized text check (phone_normalized ~ '^\+55[0-9]{10,11}$'),
  category public.guest_category not null,
  is_authority boolean not null default false,
  is_other_church_pastor boolean not null default false,
  mode public.participation_mode not null default 'indefinido',
  transport public.transport_need,
  invite_status public.invite_status not null default 'nao_contatado',
  notes text check (length(notes) <= 500),
  guardian_name text check (length(guardian_name) <= 150),
  guardian_phone text check (guardian_phone ~ '^\+55[0-9]{10,11}$'),
  -- Crédito (igreja, grupo e membro do primeiro cadastro), mantido a partir de guest_referrals.
  church_id uuid not null references public.churches (id) on delete restrict,
  group_id uuid references public.assistance_groups (id) on delete restrict,
  member_id uuid references public.members (id) on delete restrict,
  possible_duplicate boolean not null default false,
  merged_into_id uuid references public.guests (id) on delete restrict,
  is_walk_in boolean not null default false,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint guests_transport_check check (
    (mode = 'online' and transport is null) or (mode <> 'online' and transport is not null)
  ),
  constraint guests_minor_guardian_check check (
    anonymized_at is not null
    or (category in ('crianca', 'adolescente') and guardian_name is not null and guardian_phone is not null)
    or (category not in ('crianca', 'adolescente') and phone_normalized is not null)
  ),
  constraint guests_group_member_check check (member_id is null or group_id is not null)
);
create index guests_event_id_idx on public.guests (event_id);
create index guests_church_id_idx on public.guests (event_id, church_id);
create index guests_group_id_idx on public.guests (group_id);
create index guests_member_id_idx on public.guests (member_id);
create index guests_merged_into_id_idx on public.guests (merged_into_id);
create index guests_created_by_idx on public.guests (created_by);
create index guests_updated_by_idx on public.guests (updated_by);
create index guests_phone_normalized_idx on public.guests (phone_normalized);
create index guests_guardian_phone_idx on public.guests (guardian_phone);
create index guests_full_name_trgm_idx on public.guests using gin (full_name extensions.gin_trgm_ops);
create index guests_name_normalized_trgm_idx on public.guests using gin (name_normalized extensions.gin_trgm_ops);

-- Vínculo convidado ↔ membro, com snapshot de igreja/grupo no momento do cadastro.
create table public.guest_referrals (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete restrict,
  member_id uuid references public.members (id) on delete restrict,
  church_id uuid not null references public.churches (id) on delete restrict,
  group_id uuid references public.assistance_groups (id) on delete restrict,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint guest_referrals_group_member_check check (member_id is null or group_id is not null)
);
create unique index guest_referrals_one_primary_key on public.guest_referrals (guest_id) where is_primary;
create index guest_referrals_guest_id_idx on public.guest_referrals (guest_id);
create index guest_referrals_event_id_idx on public.guest_referrals (event_id);
create index guest_referrals_member_id_idx on public.guest_referrals (member_id);
create index guest_referrals_church_id_idx on public.guest_referrals (church_id);
create index guest_referrals_group_id_idx on public.guest_referrals (group_id);
create index guest_referrals_created_by_idx on public.guest_referrals (created_by);

create table public.guest_consents (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  consent_text text not null,
  given_by_guardian boolean not null default false,
  guardian_name text,
  consented_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null
);
create index guest_consents_guest_id_idx on public.guest_consents (guest_id);
create index guest_consents_recorded_by_idx on public.guest_consents (recorded_by);

create table public.duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  guest_id uuid not null references public.guests (id) on delete cascade,
  candidate_guest_id uuid not null references public.guests (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete restrict,
  similarity real not null default 0,
  reason text not null default '',
  status public.duplicate_status not null default 'pendente',
  resolution_note text check (length(resolution_note) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint duplicate_reviews_distinct_check check (guest_id <> candidate_guest_id)
);
create unique index duplicate_reviews_pair_key on public.duplicate_reviews (
  least(guest_id, candidate_guest_id), greatest(guest_id, candidate_guest_id)
);
create index duplicate_reviews_event_status_idx on public.duplicate_reviews (event_id, status);
create index duplicate_reviews_guest_id_idx on public.duplicate_reviews (guest_id);
create index duplicate_reviews_candidate_guest_id_idx on public.duplicate_reviews (candidate_guest_id);
create index duplicate_reviews_church_id_idx on public.duplicate_reviews (church_id);
create index duplicate_reviews_resolved_by_idx on public.duplicate_reviews (resolved_by);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  guest_id uuid not null references public.guests (id) on delete restrict,
  type public.attendance_type not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references public.profiles (id) on delete set null,
  client_request_id uuid,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text check (length(revoke_reason) <= 500),
  constraint attendances_revoke_check check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and length(trim(revoke_reason)) >= 3)
  )
);
-- Impede duas presenças ativas do mesmo tipo para o mesmo convidado.
create unique index attendances_active_key on public.attendances (event_id, guest_id, type)
  where revoked_at is null;
create unique index attendances_client_request_key on public.attendances (client_request_id)
  where client_request_id is not null;
create index attendances_event_id_idx on public.attendances (event_id, type);
create index attendances_guest_id_idx on public.attendances (guest_id);
create index attendances_checked_in_by_idx on public.attendances (checked_in_by);
create index attendances_revoked_by_idx on public.attendances (revoked_by);

create table public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  guest_id uuid not null references public.guests (id) on delete cascade,
  status public.transport_status not null default 'pendente',
  driver_name text check (length(driver_name) <= 150),
  pickup_point text check (length(pickup_point) <= 300),
  notes text check (length(notes) <= 500),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create unique index transport_requests_guest_key on public.transport_requests (guest_id);
create index transport_requests_event_status_idx on public.transport_requests (event_id, status);
create index transport_requests_updated_by_idx on public.transport_requests (updated_by);

create table public.goal_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  group_id uuid not null references public.assistance_groups (id) on delete restrict,
  church_id uuid not null references public.churches (id) on delete restrict,
  active boolean not null,
  taken_at timestamptz not null default now()
);
create unique index goal_snapshots_event_member_key on public.goal_snapshots (event_id, member_id);
create index goal_snapshots_member_id_idx on public.goal_snapshots (member_id);
create index goal_snapshots_group_id_idx on public.goal_snapshots (group_id);
create index goal_snapshots_church_id_idx on public.goal_snapshots (church_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  church_id uuid references public.churches (id) on delete set null,
  old_data jsonb,
  new_data jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_church_id_idx on public.audit_logs (church_id);
create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);

-- Configurações internas (ex.: marcador de ambiente). Apenas administradores leem.
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gatilhos de updated_at
-- ---------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger churches_updated_at before update on public.churches
  for each row execute function public.set_updated_at();
create trigger assistance_groups_updated_at before update on public.assistance_groups
  for each row execute function public.set_updated_at();
create trigger members_updated_at before update on public.members
  for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger event_settings_updated_at before update on public.event_settings
  for each row execute function public.set_updated_at();
create trigger guests_updated_at before update on public.guests
  for each row execute function public.set_updated_at();
create trigger transport_requests_updated_at before update on public.transport_requests
  for each row execute function public.set_updated_at();
