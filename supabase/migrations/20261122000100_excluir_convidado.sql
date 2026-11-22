-- =====================================================================
-- Exclusão de convidado, inclusive com presença registrada (pedido do usuário em 22/11/2026).
-- Sem presença: Admin, Gestor da igreja ou Responsável do grupo (mesma regra de antes).
-- Com presença: somente Gestor da igreja ou Admin (os mesmos que podem desmarcar presença),
-- com motivo obrigatório registrado na auditoria. As presenças são apagadas junto.
-- =====================================================================
create or replace function public.delete_guest(p_guest_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  g record;
  v_ids uuid[];
  v_presencas int;
begin
  select id, event_id, church_id, group_id, full_name into g from public.guests where id = p_guest_id;
  if not found then
    raise exception 'Convidado não encontrado.' using errcode = 'P0001';
  end if;
  if not private.event_is_open(g.event_id) then
    raise exception 'Esta edição do evento está encerrada (somente leitura).' using errcode = 'P0001';
  end if;
  -- O convidado e os registros mesclados nele (são a mesma pessoa).
  select array_agg(id) into v_ids from public.guests where id = p_guest_id or merged_into_id = p_guest_id;
  select count(*) into v_presencas from public.attendances where guest_id = any (v_ids);

  if v_presencas > 0 then
    if not private.has_church_access(g.church_id) then
      raise exception 'Este convidado tem presença registrada: somente o Gestor da igreja ou o Administrador pode excluí-lo.'
        using errcode = '42501';
    end if;
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Informe o motivo da exclusão (o convidado tem presença registrada).' using errcode = 'P0001';
    end if;
  elsif not private.has_record_access(g.church_id, g.group_id) then
    raise exception 'Você não tem permissão para excluir este convidado.' using errcode = '42501';
  end if;

  perform public.write_audit('guests.excluir', 'guests', p_guest_id::text, g.church_id, null,
    jsonb_build_object('motivo', nullif(trim(coalesce(p_reason, '')), ''), 'presencas_apagadas', v_presencas));

  delete from public.attendances where guest_id = any (v_ids);
  delete from public.duplicate_reviews where guest_id = any (v_ids) or candidate_guest_id = any (v_ids);
  delete from public.guests where merged_into_id = p_guest_id;
  delete from public.guests where id = p_guest_id;
end;
$$;

revoke execute on function public.delete_guest(uuid, text) from public, anon;
grant execute on function public.delete_guest(uuid, text) to authenticated;
