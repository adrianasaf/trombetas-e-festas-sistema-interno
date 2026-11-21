-- =====================================================================
-- Fase 2 — Seed de PRODUÇÃO: as 11 igrejas do Polo Torre (dados reais, não fictícios)
-- Idempotente: pode rodar em dev e prod.
-- =====================================================================
insert into public.churches (name, city) values
  ('ICM Manaíra', 'João Pessoa'),
  ('ICM Geisel', 'João Pessoa'),
  ('ICM Torre', 'João Pessoa'),
  ('ICM Bessa', 'João Pessoa'),
  ('ICM Cabedelo', 'Cabedelo'),
  ('ICM Cristo 1', 'João Pessoa'),
  ('ICM Cristo 2', 'João Pessoa'),
  ('ICM Sapé', 'Sapé'),
  ('ICM Solânea', 'Solânea'),
  ('ICM Cruz do Espírito Santo', 'Cruz do Espírito Santo'),
  ('ICM Castelo Branco', 'João Pessoa')
on conflict do nothing;
