# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

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
