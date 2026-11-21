-- =====================================================================
-- Fase 2 — Funções de escopo de acesso (security definer) e gatilhos de integridade
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções de escopo. Todas: security definer, stable, search_path vazio.
-- Um perfil inativo (profiles.active = false) perde todo o acesso.
-- ---------------------------------------------------------------------

create or replace function public.has_any_role()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.role_assignments ra
    join public.profiles p on p.id = ra.user_id
    where ra.user_id = auth.uid() and p.active
  );
$$;

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.role_assignments ra
    join public.profiles p on p.id = ra.user_id
    where ra.user_id = auth.uid() and p.active and ra.role = p_role
  );
$$;

create or replace function public.is_polo_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_role('polo_admin');
$$;

-- Igrejas com acesso de gestão (Admin: todas; Gestor: as suas).
create or replace function public.my_managed_church_ids()
returns uuid[]
language sql stable security definer
set search_path = ''
as $$
  select case
    when public.is_polo_admin() then (select coalesce(array_agg(id), '{}') from public.churches)
    else (
      select coalesce(array_agg(distinct ra.church_id), '{}')
      from public.role_assignments ra
      join public.profiles p on p.id = ra.user_id
      where ra.user_id = auth.uid() and p.active and ra.role = 'church_manager'
    )
  end;
$$;

-- Grupos sob responsabilidade direta (Responsável de Grupo).
create or replace function public.my_led_group_ids()
returns uuid[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct ra.group_id), '{}')
  from public.role_assignments ra
  join public.profiles p on p.id = ra.user_id
  where ra.user_id = auth.uid() and p.active and ra.role = 'group_leader';
$$;

-- Igrejas cujos números agregados o usuário pode ver (sem dados pessoais).
create or replace function public.my_stats_church_ids()
returns uuid[]
language sql stable security definer
set search_path = ''
as $$
  select case
    when public.is_polo_admin() or public.has_role('reception')
      or exists (
        select 1 from public.role_assignments ra join public.profiles p on p.id = ra.user_id
        where ra.user_id = auth.uid() and p.active and ra.role = 'reader' and ra.church_id is null
      )
    then (select coalesce(array_agg(id), '{}') from public.churches)
    else (
      select coalesce(array_agg(distinct x.church_id), '{}') from (
        select ra.church_id from public.role_assignments ra join public.profiles p on p.id = ra.user_id
        where ra.user_id = auth.uid() and p.active and ra.role in ('church_manager', 'reader')
          and ra.church_id is not null
        union
        select g.church_id from public.role_assignments ra
        join public.profiles p on p.id = ra.user_id
        join public.assistance_groups g on g.id = ra.group_id
        where ra.user_id = auth.uid() and p.active and ra.role = 'group_leader'
      ) x
    )
  end;
$$;

-- Leitura agregada do Polo inteiro (Admin, Recepção ou Leitor sem igreja).
create or replace function public.can_view_polo_stats()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_polo_admin() or public.has_role('reception') or exists (
    select 1 from public.role_assignments ra join public.profiles p on p.id = ra.user_id
    where ra.user_id = auth.uid() and p.active and ra.role = 'reader' and ra.church_id is null
  );
$$;

create or replace function public.has_church_access(p_church_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_church_id is not null and p_church_id = any (public.my_managed_church_ids());
$$;

create or replace function public.has_group_access(p_group_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_group_id is not null and (
    p_group_id = any (public.my_led_group_ids())
    or exists (
      select 1 from public.assistance_groups g
      where g.id = p_group_id and g.church_id = any (public.my_managed_church_ids())
    )
  );
$$;

-- Pode ver dados pessoais de um convidado/membro com esse crédito de igreja/grupo.
create or replace function public.has_record_access(p_church_id uuid, p_group_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_church_access(p_church_id)
    or (p_group_id is not null and p_group_id = any (public.my_led_group_ids()));
$$;

-- Pode operar o check-in (Admin, Recepção ou Gestor de Igreja).
create or replace function public.can_check_in()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_polo_admin() or public.has_role('reception') or public.has_role('church_manager');
$$;

-- Edição encerrada é somente leitura.
create or replace function public.event_is_open(p_event_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.status <> 'encerrado');
$$;

create or replace function public.active_event_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.events where status = 'ativo' limit 1;
$$;

-- Pode gerenciar (ver/alterar atribuições de) outro usuário.
create or replace function public.can_manage_user(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_polo_admin() or (
    public.has_role('church_manager')
    and not exists (
      select 1 from public.role_assignments ra
      where ra.user_id = p_user_id and ra.role in ('polo_admin', 'reception')
    )
    and exists (
      select 1 from public.role_assignments ra
      left join public.assistance_groups g on g.id = ra.group_id
      where ra.user_id = p_user_id
        and coalesce(ra.church_id, g.church_id) = any (public.my_managed_church_ids())
    )
  );
$$;

-- Pode conceder/remover esta atribuição.
-- Admin: qualquer uma. Gestor: Gestor/Responsável/Leitor da própria igreja (nunca Admin nem Recepção).
create or replace function public.can_grant_role(p_role public.app_role, p_church_id uuid, p_group_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_polo_admin() or (
    p_role in ('church_manager', 'group_leader', 'reader')
    and (
      (p_role in ('church_manager', 'reader') and p_church_id is not null
        and public.has_church_access(p_church_id))
      or (p_role = 'group_leader' and exists (
        select 1 from public.assistance_groups g
        where g.id = p_group_id and public.has_church_access(g.church_id)
          and (p_church_id is null or p_church_id = g.church_id)
      ))
    )
  );
$$;

-- ---------------------------------------------------------------------
-- Perfis: criados automaticamente ao entrar um usuário no Auth
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- Somente Admin altera e-mail/ativo de um perfil; o próprio usuário só muda o nome.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- operação interna (SQL/gatilho do Auth)
  end if;
  if (new.active is distinct from old.active or new.email is distinct from old.email)
     and not public.is_polo_admin() then
    raise exception 'Apenas o Administrador do Polo pode alterar a situação do usuário.'
      using errcode = '42501';
  end if;
  if new.id = auth.uid() and new.active is distinct from old.active then
    raise exception 'Você não pode desativar o próprio usuário.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Impede remover o último Administrador do Polo.
create or replace function public.guard_last_admin()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.role = 'polo_admin' and not exists (
    select 1 from public.role_assignments
    where role = 'polo_admin' and id <> old.id
  ) then
    raise exception 'Não é possível remover o último Administrador do Polo.' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger role_assignments_guard_last_admin before delete on public.role_assignments
  for each row execute function public.guard_last_admin();

-- ---------------------------------------------------------------------
-- Membros: a igreja vem do grupo; transferência gera histórico
-- ---------------------------------------------------------------------
create or replace function public.members_before_write()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group record;
begin
  select id, church_id, active into v_group from public.assistance_groups where id = new.group_id;
  if not found then
    raise exception 'Grupo de assistência não encontrado.' using errcode = '23503';
  end if;
  if (tg_op = 'INSERT' or new.group_id is distinct from old.group_id) and not v_group.active then
    raise exception 'O grupo de assistência está inativo.' using errcode = '23514';
  end if;
  -- O grupo determina a igreja (seção 7).
  new.church_id := v_group.church_id;
  if new.active then
    new.inactivated_at := null;
  elsif new.inactivated_at is null then
    new.inactivated_at := current_date;
  end if;
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := (select id from public.profiles where id = auth.uid());
  end if;
  return new;
end;
$$;

create trigger members_before_write before insert or update on public.members
  for each row execute function public.members_before_write();

create or replace function public.members_after_write()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.member_group_history (member_id, from_group_id, to_group_id, from_church_id, to_church_id, changed_by)
    values (new.id, null, new.group_id, null, new.church_id, (select id from public.profiles where id = auth.uid()));
  elsif new.group_id is distinct from old.group_id then
    insert into public.member_group_history (member_id, from_group_id, to_group_id, from_church_id, to_church_id, changed_by)
    values (new.id, old.group_id, new.group_id, old.church_id, new.church_id,
            (select id from public.profiles where id = auth.uid()));
  end if;
  return null;
end;
$$;

create trigger members_after_write after insert or update on public.members
  for each row execute function public.members_after_write();

-- Grupo não muda de igreja depois de criado (preserva o histórico).
create or replace function public.guard_group_church_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.church_id is distinct from old.church_id then
    raise exception 'Um grupo não pode mudar de igreja. Crie um novo grupo e transfira os membros.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger assistance_groups_guard_church before update on public.assistance_groups
  for each row execute function public.guard_group_church_change();

-- Igreja nunca é excluída fisicamente (apenas inativada).
create or replace function public.prevent_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registros de % não podem ser excluídos; use a inativação.', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger churches_prevent_delete before delete on public.churches
  for each row execute function public.prevent_delete();

-- ---------------------------------------------------------------------
-- Eventos: configurações criadas junto; corte e encerramento
-- ---------------------------------------------------------------------
create or replace function public.events_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.event_settings (event_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;

create trigger events_after_insert after insert on public.events
  for each row execute function public.events_after_insert();

create or replace function public.events_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'encerrado' and old.status <> 'encerrado' then
    new.closed_at := now();
  elsif new.status <> 'encerrado' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger events_before_update before update on public.events
  for each row execute function public.events_before_update();

-- ---------------------------------------------------------------------
-- Cadastro do primeiro Administrador do Polo.
-- Executável apenas pelo dono do banco (SQL Editor / Supabase CLI), nunca pela API.
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_polo_admin(p_email text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Usuário % não encontrado no Auth. Crie-o primeiro em Authentication > Users.', p_email;
  end if;
  insert into public.profiles (id, email) values (v_user_id, lower(trim(p_email)))
    on conflict (id) do update set active = true;
  if exists (select 1 from public.role_assignments where user_id = v_user_id and role = 'polo_admin') then
    return 'O usuário já é Administrador do Polo.';
  end if;
  insert into public.role_assignments (user_id, role) values (v_user_id, 'polo_admin');
  return 'Administrador do Polo cadastrado: ' || p_email;
end;
$$;

revoke all on function public.bootstrap_polo_admin(text) from public, anon, authenticated;
