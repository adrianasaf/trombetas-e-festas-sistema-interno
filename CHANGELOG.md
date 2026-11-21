# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Fase 2] — 2026-11-21 — Banco, migrations, RLS, auth e perfis

### Adicionado
- Migrations versionadas em `supabase/migrations/`: extensões (`pg_trgm`, `pgcrypto`), enums, 17 tabelas
  (as 16 da seção 18 + `app_settings`), FKs, `check` constraints, índices em todas as FKs, índice em
  `guests(phone_normalized)` e índices trigram em `guests(full_name)` e `members(full_name)`.
- Índice único parcial de presença ativa e índice de evento ativo único.
- Funções `security definer` de escopo: `is_polo_admin()`, `has_church_access()`, `has_group_access()`,
  `has_record_access()`, `can_check_in()`, `can_grant_role()`, `can_manage_user()` e outras.
- RLS habilitado em todas as tabelas; escrita por coluna restrita (crédito de convidado só muda por RPC).
- Gatilhos: perfil criado ao entrar no Auth; igreja do membro vem do grupo; histórico de transferência;
  proteção contra excluir igreja e contra remover o último Admin; auditoria em `audit_logs`.
- Seed de produção com as 11 igrejas (migration idempotente). Bucket `logos` (público, 2 MB, PNG/SVG/JPG).
- Edge Function `convidar-usuario` (convite por e-mail; service_role apenas no servidor).
- Frontend: login, recuperação e redefinição de senha, aceite de convite, sair / sair de todos os
  dispositivos, rotas protegidas por perfil, tela "Usuários e permissões".
- Script `npm run admin:criar -- email` para cadastrar o primeiro Administrador do Polo.
- Testes de banco locais com PGlite (31 cenários de RLS e integridade) e script `npm run test:rls`
  para testar RLS pela API no banco real.

- Migration `20261121000800_schema_private.sql`: funções auxiliares de escopo movidas para o schema
  `private`, que a API não expõe (recomendação do Supabase Advisor).
- Aplicado no projeto DEV: 8 migrations, marcador de ambiente DEV, Edge Function `convidar-usuario`
  publicada, tipos gerados em `src/lib/database.types.ts`.
- Auth do DEV configurado via `supabase config push`: cadastro público desligado, senha mínima de 8 com
  letras e números, `site_url` na Vercel e URLs de redirecionamento (as já existentes foram mantidas).

### Corrigido
- Scripts que executam SQL remoto agora usam arquivo temporário (`--file`); no Windows o SQL era
  quebrado em vários argumentos.
- Preparo dos testes de RLS: a senha aleatória era substituída no comentário, e não no SQL.

## [Fase 1] — 2026-11-21 — Estrutura do projeto e CI

### Adicionado
- Projeto React 19 + TypeScript + Vite 7 + Tailwind CSS 4, com componentes no padrão shadcn/ui (botão, campo, rótulo, cartão, skeleton).
- Identidade visual base: azul-marinho, dourado e tons claros; botões com alvo mínimo de 44 px; marca em tipografia até o upload da logo.
- Layout com menu lateral (gaveta no celular) filtrado por perfil, cabeçalho, rodapé com link para a política de privacidade.
- Faixa "AMBIENTE DE DEMONSTRAÇÃO" quando `VITE_APP_ENV=dev`.
- Páginas: inicial provisória, política de privacidade, 403, 404 e "configuração incompleta" (variáveis ausentes).
- Utilitários: normalização de telefone brasileiro para E.164, formatação e máscara `(83) 9****-1234`; leitura validada das variáveis de ambiente; mapa de menu por perfil.
- Cliente Supabase com anon key (sem `service_role`).
- ESLint 9, Prettier, Vitest + Testing Library; 25 testes.
- GitHub Actions: lint, typecheck, testes e build a cada push/PR.
- `vercel.json` com rewrite de SPA e cabeçalhos de segurança; `.env.example`; `.gitignore` bloqueando `.env*`.
- `CLAUDE.md`, `docs/PROGRESSO.md`, `docs/DECISOES.md`, `docs/TESTES.md`.
