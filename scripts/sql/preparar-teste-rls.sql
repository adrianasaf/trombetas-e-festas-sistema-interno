-- Prepara usuários e dados de TESTE DE RLS no projeto DEV. NUNCA rodar em produção.
-- O marcador de senha (entre chaves duplas) é substituído por uma senha aleatória gerada a cada execução
-- por scripts/testar-rls.mjs (a senha não é gravada em arquivo nem exibida).
do $$
declare
  v_env text;
  v_pwd text := '{{SENHA}}';
  v_users text[] := array['rls.admin', 'rls.gestor.a', 'rls.resp.a1', 'rls.recepcao', 'rls.leitor.a', 'rls.leitor.polo'];
  v_name text;
  v_id uuid;
  v_church_a uuid;
  v_church_b uuid;
  v_group_a1 uuid;
  v_group_b1 uuid;
  v_member_a uuid;
  v_member_b uuid;
  v_event uuid;
begin
  select value into v_env from public.app_settings where key = 'environment';
  if v_env is distinct from 'dev' then
    raise exception 'Este script só roda no ambiente DEV (app_settings.environment = dev).';
  end if;

  foreach v_name in array v_users loop
    select id into v_id from auth.users where email = v_name || '@teste.trombetas.dev';
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        v_name || '@teste.trombetas.dev', extensions.crypt(v_pwd, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', '[TESTE] ' || v_name),
        now(), now(), '', '', '', ''
      );
      insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
      values (gen_random_uuid(), v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', v_name || '@teste.trombetas.dev', 'email_verified', true),
        'email', now(), now(), now());
    else
      update auth.users set encrypted_password = extensions.crypt(v_pwd, extensions.gen_salt('bf')) where id = v_id;
    end if;
  end loop;

  select id into v_church_a from public.churches where name = 'ICM Manaíra';
  select id into v_church_b from public.churches where name = 'ICM Geisel';

  insert into public.assistance_groups (church_id, name, leader_name) values (v_church_a, '[TESTE RLS] Grupo A1', 'Teste')
    on conflict do nothing;
  insert into public.assistance_groups (church_id, name, leader_name) values (v_church_b, '[TESTE RLS] Grupo B1', 'Teste')
    on conflict do nothing;
  insert into public.assistance_groups (church_id, name, leader_name) values (v_church_a, '[TESTE RLS] Grupo A2', 'Teste')
    on conflict do nothing;
  select id into v_group_a1 from public.assistance_groups where name = '[TESTE RLS] Grupo A1';
  select id into v_group_b1 from public.assistance_groups where name = '[TESTE RLS] Grupo B1';

  select id into v_member_a from public.members where full_name = '[TESTE RLS] Membro A';
  if v_member_a is null then
    insert into public.members (full_name, group_id, church_id) values ('[TESTE RLS] Membro A', v_group_a1, v_church_a)
      returning id into v_member_a;
  end if;
  select id into v_member_b from public.members where full_name = '[TESTE RLS] Membro B';
  if v_member_b is null then
    insert into public.members (full_name, group_id, church_id) values ('[TESTE RLS] Membro B', v_group_b1, v_church_b)
      returning id into v_member_b;
  end if;

  select id into v_event from public.events where status = 'ativo';
  if v_event is null then
    insert into public.events (name, year, status) values ('Trombetas e Festas (demonstração)', 2026, 'ativo')
      returning id into v_event;
  end if;

  if not exists (select 1 from public.guests where full_name = '[TESTE RLS] Convidado A') then
    insert into public.guests (event_id, full_name, phone_normalized, category, mode, transport, church_id, group_id, member_id)
    values (v_event, '[TESTE RLS] Convidado A', '+5583990000001', 'homem', 'presencial', 'meios_proprios', v_church_a, v_group_a1, v_member_a);
  end if;
  if not exists (select 1 from public.guests where full_name = '[TESTE RLS] Convidado B') then
    insert into public.guests (event_id, full_name, phone_normalized, category, mode, transport, church_id, group_id, member_id)
    values (v_event, '[TESTE RLS] Convidado B', '+5583990000002', 'mulher', 'presencial', 'meios_proprios', v_church_b, v_group_b1, v_member_b);
  end if;

  -- Atribuições
  insert into public.role_assignments (user_id, role)
    select id, 'polo_admin' from auth.users where email = 'rls.admin@teste.trombetas.dev' on conflict do nothing;
  insert into public.role_assignments (user_id, role, church_id)
    select id, 'church_manager', v_church_a from auth.users where email = 'rls.gestor.a@teste.trombetas.dev' on conflict do nothing;
  insert into public.role_assignments (user_id, role, group_id)
    select id, 'group_leader', v_group_a1 from auth.users where email = 'rls.resp.a1@teste.trombetas.dev' on conflict do nothing;
  insert into public.role_assignments (user_id, role)
    select id, 'reception' from auth.users where email = 'rls.recepcao@teste.trombetas.dev' on conflict do nothing;
  insert into public.role_assignments (user_id, role, church_id)
    select id, 'reader', v_church_a from auth.users where email = 'rls.leitor.a@teste.trombetas.dev' on conflict do nothing;
  insert into public.role_assignments (user_id, role)
    select id, 'reader' from auth.users where email = 'rls.leitor.polo@teste.trombetas.dev' on conflict do nothing;
end $$;
