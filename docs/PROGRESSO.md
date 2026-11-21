# Progresso das fases

Ao retomar uma sessão, continue da primeira fase não marcada. Detalhes de cada fase em `CHANGELOG.md` e `docs/TESTES.md`.

- [x] **Fase 1** — Estrutura do projeto, repositório, CI básico (lint + typecheck + testes no GitHub Actions)
- [x] **Fase 2** — Banco, migrations, RLS, auth e perfis (DEV aplicado; e-mails dependem de SMTP próprio)
- [x] **Fase 3** — Igrejas, grupos e membros
- [x] **Fase 4** — Convidados, consentimento e duplicidades
- [x] **Fase 5** — Motor de metas e snapshots
- [x] **Fase 6** — Check-in, walk-in, fila de retentativa e tempo real
- [x] **Fase 7** — Dashboards
- [x] **Fase 8** — Transporte e relatórios
- [x] **Fase 9** — Auditoria, revisão de segurança, seed de demonstração e teste de carga (parcial: ver pendências)
- [ ] **Fase 10** — Preparação para implantação (Vercel + Supabase prod + SMTP + domínio)

## Ambiente
- Supabase CLI vinculado ao DEV `zaawhfbmuogfyigxscta`; `.env.local` criado (fora do git).
- Comandos: `npx supabase db push --remote --yes`, `npm run test:rls`, `npm run db:types`.

## Pendências registradas (por decisão do usuário em 21/11/2026)
- **Testes E2E (Playwright):** interrompidos a pedido. Os arquivos `playwright.config.ts` e `e2e/` existem, mas **nunca foram executados**. Incluem login, permissões no menu, cadastro rápido, check-in e capturas de layout em 360/768/1280 px. Para rodar: `npx playwright install chromium` e `npm run test:e2e`.
- **Anonimização (LGPD):** implementada (migrations 1500/1600, tela em Configurações) e testada só no banco local (11 testes). **Não foi validada no DEV nem pela interface.** Fica pendente de validação.
- **Layout 360 px / tablet / desktop das telas logadas:** não verificado (dependia do Playwright).

## Pendências que dependem do usuário
- SMTP próprio no Supabase Auth (para convites e recuperação de senha chegarem a qualquer e-mail).
