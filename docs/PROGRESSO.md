# Progresso das fases

Ao retomar uma sessão, continue da primeira fase não marcada. Detalhes de cada fase em `CHANGELOG.md` e `docs/TESTES.md`.

- [x] **Fase 1** — Estrutura do projeto, repositório, CI básico (lint + typecheck + testes no GitHub Actions)
- [ ] **Fase 2** — Banco, migrations, RLS, auth e perfis — *código e testes locais prontos; falta aplicar no DEV, publicar a Edge Function e rodar `npm run test:rls`*
- [ ] **Fase 3** — Igrejas, grupos e membros
- [ ] **Fase 4** — Convidados, consentimento e duplicidades
- [ ] **Fase 5** — Motor de metas e snapshots
- [ ] **Fase 6** — Check-in, walk-in, fila de retentativa e tempo real
- [ ] **Fase 7** — Dashboards
- [ ] **Fase 8** — Transporte e relatórios
- [ ] **Fase 9** — LGPD (anonimização, auditoria), revisão de segurança e bateria completa de testes
- [ ] **Fase 10** — Preparação para implantação (Vercel + Supabase prod + SMTP + domínio)

## Pendências que dependem do usuário
- Login no Supabase CLI e na Vercel CLI (navegador).
- Anon key do projeto DEV (vai apenas em `.env.local` e na Vercel).
