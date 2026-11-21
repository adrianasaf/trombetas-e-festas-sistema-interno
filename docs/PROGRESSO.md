# Progresso das fases

Ao retomar uma sessão, continue da primeira fase não marcada. Detalhes de cada fase em `CHANGELOG.md` e `docs/TESTES.md`.

- [x] **Fase 1** — Estrutura do projeto, repositório, CI básico (lint + typecheck + testes no GitHub Actions)
- [x] **Fase 2** — Banco, migrations, RLS, auth e perfis (DEV aplicado; e-mails dependem de SMTP próprio)
- [x] **Fase 3** — Igrejas, grupos e membros
- [x] **Fase 4** — Convidados, consentimento e duplicidades
- [x] **Fase 5** — Motor de metas e snapshots
- [x] **Fase 6** — Check-in, walk-in, fila de retentativa e tempo real
- [x] **Fase 7** — Dashboards
- [ ] **Fase 8** — Transporte e relatórios
- [ ] **Fase 9** — LGPD (anonimização, auditoria), revisão de segurança e bateria completa de testes
- [ ] **Fase 10** — Preparação para implantação (Vercel + Supabase prod + SMTP + domínio)

## Ambiente
- Supabase CLI vinculado ao DEV `zaawhfbmuogfyigxscta`; `.env.local` criado (fora do git).
- Comandos: `npx supabase db push --remote --yes`, `npm run test:rls`, `npm run db:types`.

## Pendências que dependem do usuário
- Criar o primeiro Administrador do Polo (Auth → Add user; depois `npm run admin:criar -- email`).
- SMTP próprio no Supabase Auth (para convites e recuperação de senha chegarem a qualquer e-mail).
