-- =====================================================================
-- SEED DE DEMONSTRAÇÃO — SOMENTE NO PROJETO DEV. NUNCA EM PRODUÇÃO.
-- Dados 100% fictícios: 44 grupos ("Demo"), 880 membros e 3.000 convidados,
-- com presenças, online, transporte e datas espalhadas para os gráficos.
-- Proteções: scripts/seed-demo.mjs confere o project ref, e este SQL exige
-- app_settings.environment = 'dev'. Para remover: scripts/sql/limpar-demo.sql.
-- =====================================================================
do $$
declare
  v_env text;
  v_event uuid;
  first_m text[] := array['João','José','Antônio','Francisco','Carlos','Paulo','Pedro','Lucas','Marcos','Luiz',
    'Gabriel','Rafael','Daniel','Marcelo','Bruno','Eduardo','Felipe','Rodrigo','Thiago','Mateus'];
  first_f text[] := array['Maria','Ana','Francisca','Antônia','Adriana','Juliana','Márcia','Fernanda','Patrícia','Aline',
    'Sandra','Camila','Amanda','Bruna','Jéssica','Letícia','Larissa','Mariana','Beatriz','Raquel'];
  last_n text[] := array['Silva','Santos','Oliveira','Souza','Lima','Pereira','Ferreira','Costa','Rodrigues','Almeida',
    'Nascimento','Alves','Carvalho','Araújo','Ribeiro','Gomes','Martins','Barbosa','Rocha','Dias',
    'Cavalcanti','Medeiros','Batista','Freitas','Moura','Lacerda','Brito','Diniz','Queiroz','Teixeira'];
  v_members int;
  v_guests int;
begin
  select value into v_env from public.app_settings where key = 'environment';
  if v_env is distinct from 'dev' then
    raise exception 'Seed de demonstração bloqueado: este banco não está marcado como DEV.';
  end if;
  if exists (select 1 from public.assistance_groups where name like 'Grupo Demo %') then
    raise exception 'O seed de demonstração já foi aplicado. Rode limpar-demo.sql antes de repetir.';
  end if;

  select id into v_event from public.events where status = 'ativo';
  if v_event is null then
    insert into public.events (name, year, status, starts_at, location)
    values ('Trombetas e Festas 2026', 2026, 'ativo', now() + interval '14 days', 'Ginásio do Polo Torre (demonstração)')
    returning id into v_event;
  else
    update public.events set starts_at = coalesce(starts_at, now() + interval '14 days'),
      location = coalesce(location, 'Ginásio do Polo Torre (demonstração)')
    where id = v_event;
  end if;

  -- 4 grupos por igreja
  insert into public.assistance_groups (church_id, name, leader_name)
  select c.id, 'Grupo Demo ' || n, first_m[1 + (abs(hashtext(c.name || n)) % 20)] || ' ' || last_n[1 + (abs(hashtext(n || c.name)) % 30)]
  from public.churches c cross join generate_series(1, 4) n;

  -- 20 membros por grupo (880); alguns inativos
  insert into public.members (full_name, group_id, church_id, joined_at, active, inactivated_at)
  select
    case when (g.rn * 20 + i) % 2 = 0 then first_m[1 + ((g.rn * 7 + i * 3) % 20)] else first_f[1 + ((g.rn * 5 + i * 11) % 20)] end
      || ' ' || last_n[1 + ((g.rn * 13 + i * 7) % 30)] || ' ' || last_n[1 + ((g.rn * 3 + i * 17) % 30)],
    g.id, g.church_id, current_date - ((g.rn + i) % 700)::int,
    (g.rn * 20 + i) % 37 <> 0,
    case when (g.rn * 20 + i) % 37 = 0 then current_date - 10 end
  from (select id, church_id, row_number() over (order by church_id, name) rn
        from public.assistance_groups where name like 'Grupo Demo %') g
  cross join generate_series(1, 20) i;
  get diagnostics v_members = row_count;

  -- 3.000 convidados, creditados a membros ativos (distribuição desigual entre grupos)
  with m as (
    select id, church_id, group_id, row_number() over (order by church_id, group_id, id) rn
    from public.members where active and group_id in (select id from public.assistance_groups where name like 'Grupo Demo %')
  ),
  cnt as (select count(*) n from m),
  src as (
    select s,
      (select id from m where rn = 1 + ((s * s * 7 + s * 13) % (select n from cnt))) as member_id,
      (array['homem','mulher','mulher','homem','jovem_masculino','jovem_feminino','crianca','adolescente','mulher','homem'])[1 + (s % 10)]::public.guest_category as cat
    from generate_series(1, 3000) s
  )
  insert into public.guests (event_id, full_name, phone_normalized, category, mode, transport, invite_status,
    guardian_name, guardian_phone, church_id, group_id, member_id, is_authority, is_other_church_pastor, created_at)
  select v_event,
    case when src.cat in ('homem','jovem_masculino') or (src.cat in ('crianca','adolescente') and src.s % 2 = 0)
      then first_m[1 + ((src.s * 7) % 20)] else first_f[1 + ((src.s * 11) % 20)] end
      || ' ' || last_n[1 + ((src.s * 13) % 30)] || ' ' || last_n[1 + ((src.s * 29) % 30)],
    case when src.cat in ('crianca','adolescente') then null
      else '+55839' || lpad(((src.s * 7919 + 12345) % 100000000)::text, 8, '0') end,
    src.cat,
    (array['presencial','presencial','presencial','presencial','presencial','online','indefinido','presencial'])[1 + (src.s % 8)]::public.participation_mode,
    case when (src.s % 8) = 5 then null
      else (array['meios_proprios','meios_proprios','precisa_transporte','meios_proprios','indefinido','meios_proprios','meios_proprios','meios_proprios','meios_proprios','meios_proprios'])[1 + (src.s % 10)]::public.transport_need end,
    (array['convidado','confirmou','confirmou','nao_contatado','convidado','confirmou','nao_comparecera','confirmou'])[1 + ((src.s * 3) % 8)]::public.invite_status,
    case when src.cat in ('crianca','adolescente') then first_f[1 + ((src.s * 3) % 20)] || ' ' || last_n[1 + ((src.s * 13) % 30)] end,
    case when src.cat in ('crianca','adolescente') then '+55839' || lpad(((src.s * 104729 + 777) % 100000000)::text, 8, '0') end,
    m.church_id, m.group_id, m.id,
    src.s % 97 = 0, src.s % 113 = 0,
    now() - make_interval(days => (src.s * 31) % 30, hours => (src.s * 7) % 24)
  from src join m on m.id = src.member_id;
  get diagnostics v_guests = row_count;

  -- Snapshot do vínculo e consentimento para cada convidado
  insert into public.guest_referrals (guest_id, event_id, member_id, church_id, group_id, is_primary, created_at)
  select g.id, g.event_id, g.member_id, g.church_id, g.group_id, true, g.created_at
  from public.guests g
  where g.event_id = v_event and g.group_id in (select id from public.assistance_groups where name like 'Grupo Demo %')
    and not exists (select 1 from public.guest_referrals r where r.guest_id = g.id);

  insert into public.guest_consents (guest_id, consent_text, given_by_guardian, guardian_name, consented_at)
  select g.id, private.consent_text(g.category in ('crianca','adolescente')),
    g.category in ('crianca','adolescente'), g.guardian_name, g.created_at
  from public.guests g
  where g.event_id = v_event and g.group_id in (select id from public.assistance_groups where name like 'Grupo Demo %')
    and not exists (select 1 from public.guest_consents c where c.guest_id = g.id);

  -- Presenças presenciais (~38%) e online (~6%), simulando o dia do evento
  insert into public.attendances (event_id, guest_id, type, checked_in_at)
  select v_event, g.id, 'presencial', now() - make_interval(mins => (abs(hashtext(g.id::text)) % 180))
  from public.guests g
  where g.event_id = v_event and g.mode <> 'online'
    and g.group_id in (select id from public.assistance_groups where name like 'Grupo Demo %')
    and abs(hashtext(g.id::text || 'p')) % 100 < 42;
  insert into public.attendances (event_id, guest_id, type, checked_in_at)
  select v_event, g.id, 'online', now() - interval '1 hour'
  from public.guests g
  where g.event_id = v_event and g.mode = 'online'
    and g.group_id in (select id from public.assistance_groups where name like 'Grupo Demo %')
    and abs(hashtext(g.id::text || 'o')) % 100 < 50;

  -- Alguns transportes já organizados
  update public.transport_requests t set status = 'organizado', driver_name = 'Equipe de transporte (demo)'
  where t.event_id = v_event and abs(hashtext(t.id::text)) % 3 = 0;

  raise notice 'Seed de demonstração: % membros, % convidados.', v_members, v_guests;
end $$;
