-- Telefone opcional para adultos NO BANCO, para importar listas com telefone faltando ou inválido.
-- O formulário do site e a RPC create_guest continuam exigindo telefone em cadastros novos.
-- Criança/Adolescente continuam exigindo responsável legal com telefone.
alter table public.guests drop constraint guests_minor_guardian_check;
alter table public.guests add constraint guests_minor_guardian_check check (
  anonymized_at is not null
  or (category in ('crianca', 'adolescente') and guardian_name is not null and guardian_phone is not null)
  or category not in ('crianca', 'adolescente')
);
