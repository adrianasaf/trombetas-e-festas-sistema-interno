-- Remove o seed de demonstração (somente DEV). Mantém igrejas, usuários e os dados de teste de RLS.
do $$
declare
  v_env text;
begin
  select value into v_env from public.app_settings where key = 'environment';
  if v_env is distinct from 'dev' then
    raise exception 'Limpeza bloqueada: este banco não está marcado como DEV.';
  end if;
  create temporary table demo_guests on commit drop as
    select id from public.guests where group_id in (select id from public.assistance_groups where name like 'Grupo Demo %');
  delete from public.attendances where guest_id in (select id from demo_guests);
  delete from public.duplicate_reviews where guest_id in (select id from demo_guests) or candidate_guest_id in (select id from demo_guests);
  update public.guests set merged_into_id = null where merged_into_id in (select id from demo_guests);
  delete from public.guests where id in (select id from demo_guests);
  delete from public.goal_snapshots where group_id in (select id from public.assistance_groups where name like 'Grupo Demo %');
  delete from public.members where group_id in (select id from public.assistance_groups where name like 'Grupo Demo %');
  delete from public.assistance_groups where name like 'Grupo Demo %';
  delete from public.audit_logs where table_name in ('guests', 'guest_referrals', 'attendances', 'transport_requests')
    and record_id is not null and not exists (select 1 from public.guests g where g.id::text = record_id)
    and created_at > now() - interval '30 days' and user_id is null;
end $$;
