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
- [x] **Fase 10** — Preparação para implantação: README com Supabase, Vercel, SMTP e primeiro Admin (projeto de produção, SMTP e domínio ficam com o usuário)

## ⚠️ Virada para produção — 22/11/2026
- O projeto `zaawhfbmuogfyigxscta` passou a ser a **PRODUÇÃO oficial** (`environment = prod`).
- Removidos os dados de teste e de demonstração (script `scripts/sql/virada-producao.sql`, executado uma vez).
  Mantidos os dados reais: 11 igrejas, 2 usuários (Administrador do Polo e um Gestor da ICM Manaíra),
  o "GRUPO A" com 1 membro e 1 convidado, e a auditoria dessas ações.
- Evento único ativo: "Trombetas e Festas 2026", 28/11/2026 às 17h, metas 3 e 1. Data de corte e local: ajustar em Configurações.
- Nunca rodar seed, testes com escrita ou limpeza neste projeto; migrations novas só com revisão.

## Ambiente
- Supabase CLI vinculado à PRODUÇÃO `zaawhfbmuogfyigxscta`; `.env.local` criado (fora do git).
- Comandos seguros em produção: `npm run db:types`, `npm run admin:criar -- email`. `test:rls`/`test:carga`/`seed:demo` são recusados.

## Pendências registradas (por decisão do usuário em 21/11/2026)
- **Testes E2E (Playwright):** interrompidos a pedido. Os arquivos `playwright.config.ts` e `e2e/` existem, mas **nunca foram executados**. Incluem login, permissões no menu, cadastro rápido, check-in e capturas de layout em 360/768/1280 px. Para rodar: `npx playwright install chromium` e `npm run test:e2e`.
- **Anonimização (LGPD):** implementada (migrations 1500/1600, tela em Configurações) e testada só no banco local (11 testes). **Não foi validada no DEV nem pela interface.** Fica pendente de validação.
- **Layout 360 px / tablet / desktop das telas logadas:** não verificado (dependia do Playwright).

## Pendências que dependem do usuário
- SMTP próprio no Supabase Auth (para convites e recuperação de senha chegarem a qualquer e-mail).
