# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Fase 7] — 2026-11-21 — Dashboards

### Adicionado
- RPCs agregadas `stats_daily` (por dia no fuso de Fortaleza), `stats_categories` e `stats_transport`,
  no escopo de cada perfil.
- Dashboard geral do Polo: cartões da seção 13 (igrejas, grupos, membros na meta, metas, convidados,
  percentuais, presenças, confirmados, online, transporte, membros que cumpriram/abaixo), convites e
  presença por igreja, ranking das igrejas e dos grupos por % da meta **sempre com os absolutos**
  ("82% — 246/300"), evolução diária, categorias, presencial × online e situação do transporte.
- Painel da igreja (na tela da igreja) com lista de grupos clicável; painel do grupo (na tela do grupo)
  com tabela de desempenho por membro (convidados/meta, presentes/meta, situação com cor + texto).
- Página inicial escolhe o painel pelo perfil: Polo (Admin, Recepção, Leitor do Polo), igreja (Gestor,
  Leitor da igreja, com seletor se houver mais de uma) ou grupo (Responsável).
- Gráficos próprios em SVG/HTML, sem biblioteca: barras com tooltip, linha com cruz e tooltip ao
  passar o mouse/dedo, legenda, botão "Ver tabela" em cada gráfico; paleta validada pelo script da
  skill de visualização (2 séries, todas as checagens aprovadas).

### Removido
- Página inicial provisória (substituída pelo dashboard).

## [Fase 6] — 2026-11-21 — Check-in, walk-in, fila de retentativa e tempo real

### Adicionado
- RPC `check_in` atômica e idempotente (`on conflict` no índice único parcial + `client_request_id`):
  em corrida, uma marcação registra e as demais recebem "já registrada" com hora e usuário.
- RPC `search_checkin` (nome sem acento, similaridade trigram ou trecho do telefone), sempre com telefone
  mascarado `(83) 9****-1234`, para Admin, Recepção e Gestor; índices trigram de telefone e nome de membro.
- Cadastro na chegada `walk_in_check_in` (formulário mínimo, consentimento, responsável legal para menores,
  "Sem membro identificado" com igreja obrigatória), também idempotente.
- `revoke_attendance` (somente Gestor da igreja ou Admin, motivo obrigatório, sem apagar a linha) e
  `attendance_history` com nomes de quem marcou/desmarcou. Online registrado pelo membro/gestor
  (autodeclarado) e independente do presencial.
- Sinal de tempo real por Broadcast (`tef-sinal`/`mudou`), um por comando, sem dados pessoais; o cliente
  recarrega os agregados com debounce de 2 s, ao reconectar e a cada 60 s como rede de segurança.
- Tela de Check-in mobile-first: busca única com debounce, cartões grandes, botão
  "COMPARECEU AO EVENTO ✓", som e vibração opcionais, aviso "Presença já registrada às 19:42 por Fulano",
  cadastro na chegada e contador "X check-ins aguardando envio".
- Fila local de retentativa em IndexedDB (com queda para memória), reenvio ao voltar a conexão, ao focar a
  aba e a cada 15 s; erros de regra não ficam presos na fila.
- Ficha do convidado: destaque "[ ] COMPARECEU AO EVENTO?" com data/hora e usuário, desmarcação com
  motivo, participação online e histórico. Indicador de tempo real no cabeçalho.

## [Fase 5] — 2026-11-21 — Motor de metas e snapshots

### Adicionado
- Funções no banco: `goal_summary` (Polo, igreja ou grupo), `goal_by_church`, `goal_by_group` e
  `member_goal_stats` — meta de convites, meta presencial, convidados únicos, presenças presenciais,
  percentuais, confirmados, participações online (confirmadas, registradas e só online), alcance total,
  transporte, cadastros na chegada e membros que cumpriram/estão abaixo de cada meta. Tudo calculado no
  banco, no escopo de cada perfil; o Leitor vê só números agregados.
- Data de corte: snapshot automático em `goal_snapshots` via pg_cron (a cada minuto), ao salvar uma data
  de corte já vencida e ao encerrar a edição; botão do Admin para gravar ou refazer (auditado).
- Tela Configurações: edições do evento (criar, editar, ativar, encerrar), metas por membro, data de
  corte, snapshot, logomarca (Storage, PNG/SVG/JPG até 2 MB), som do check-in, prazo de retenção e
  política de retenção.
- Cartão de metas na ficha do membro (convidados/meta, presentes/meta, indicador de meta cumprida).

## [Fase 4] — 2026-11-21 — Convidados, consentimento e duplicidades

### Adicionado
- RPC `create_guest`: cadastro sempre a partir de um membro, com snapshot de igreja/grupo em
  `guest_referrals`, consentimento obrigatório gravado em `guest_consents` (data, hora, usuário e texto;
  para criança/adolescente, consentimento do responsável legal — LGPD art. 14), validação de telefone
  (E.164), responsável legal obrigatório para menores, limite de 500 caracteres nas observações e
  bloqueio para membro inativo e edição encerrada.
- Regras automáticas: modalidade Online zera o transporte; "Precisa de transporte" cria/cancela a
  solicitação no módulo de transporte.
- Detecção de duplicidade (telefone do convidado ou do responsável + similaridade de nome com
  `pg_trgm`), sem bloquear o cadastro; reavaliada quando nome ou telefone mudam.
- RPCs `list_duplicate_reviews`, `merge_guests` (mantém um registro, preserva indicações, consentimentos e
  presenças; crédito com o primeiro cadastro), `resolve_duplicate_distinct` e `reassign_guest_credit`
  (justificativa obrigatória, auditada).
- Seletor de edição do evento no topo; edição encerrada exibida como somente leitura.
- Telas: Convidados (busca por nome/telefone e filtros de igreja, grupo, categoria, situação, modalidade,
  transporte, marcação especial e duplicidade), ficha do convidado (destaque de presença, dados,
  consentimento, membros que indicaram, reatribuição de crédito, exclusão), Duplicidades (lado a lado,
  mesclar ou "pessoas diferentes") e cadastro rápido com 5 linhas + "adicionar mais" na ficha do membro.

## [Fase 3] — 2026-11-21 — Igrejas, grupos e membros

### Adicionado
- RPCs agregadas `church_overview()` e `group_overview()` (contagens de grupos e membros, sem dados
  pessoais, no escopo de estatística do usuário — o Leitor também usa).
- Telas: Igrejas (cartões, cadastro/edição/inativação pelo Admin), detalhes da igreja com seus grupos,
  Grupos de assistência (filtro por igreja, cadastro/edição/inativação), detalhes do grupo com membros,
  Membros (busca, filtros de igreja/grupo/situação), ficha do membro com histórico de grupos.
- Transferência de grupo com aviso de que os convites antigos continuam com o grupo de origem;
  histórico gravado automaticamente.
- A igreja do membro nunca é digitada: vem do grupo (o cliente nem envia `church_id`).
- Componentes de formulário (`Field`, `CheckboxField`, `GroupPicker`) e utilitários de data no fuso
  America/Fortaleza.
- 19 novos testes de banco locais e 6 novos cenários no teste real via API.

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
