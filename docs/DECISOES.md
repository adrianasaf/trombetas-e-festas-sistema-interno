# Registro de decisões

Decisões tomadas onde a especificação era omissa ou ambígua. Formato: contexto → decisão → motivo.

## Fase 1

### D-001 — Componentes shadcn/ui escritos no repositório
- **Contexto:** o `shadcn init` é interativo e muda de formato entre versões.
- **Decisão:** os componentes seguem o padrão shadcn/ui (Radix + `cva` + `cn`), versionados em `src/components/ui`, com `components.json` presente para usar `npx shadcn add` no futuro.
- **Motivo:** o shadcn/ui é, por definição, código copiado para o projeto; assim o resultado é reproduzível.

### D-002 — DDD padrão 83 na normalização de telefone
- **Contexto:** muitos usuários digitam o número sem DDD.
- **Decisão:** números com 8 ou 9 dígitos recebem o DDD 83 (Paraíba, onde ficam as 11 igrejas). Celular precisa começar com 9; fixo, com 2 a 5. Números inválidos são rejeitados com mensagem.
- **Motivo:** coerente com a região do Polo e evita duplicidades por formatos diferentes do mesmo número.

### D-003 — Versões da stack
- **Decisão:** React 19, Vite 7, TypeScript 5.9, Tailwind 4, Vitest 3, ESLint 9, Node 22 no CI.
- **Motivo:** versões estáveis e suportadas; Tailwind 4 dispensa `tailwind.config.js` (tema em CSS).

### D-004 — Cabeçalhos de segurança na Vercel
- **Decisão:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` restritiva em `vercel.json`.
- **Motivo:** menor superfície de ataque sem custo; o sistema não precisa ser embutido em outros sites.

### D-005 — Nomes de perfis no código
- **Decisão:** `polo_admin`, `church_manager`, `group_leader`, `reception`, `reader` (enum `app_role` no banco), com rótulos em português na interface.

### D-006 — Vercel conectada pelo usuário
- **Decisão:** a Vercel foi ligada ao repositório pelo painel, com as variáveis já configuradas. Não criar outro projeto nem rodar `vercel link`.

## Fase 2

### D-007 — Testes de banco sem Docker (PGlite)
- **Contexto:** Docker não está disponível na máquina, então `supabase start` não roda.
- **Decisão:** as migrations são aplicadas num Postgres real em WebAssembly (PGlite, Postgres 18) com um esboço mínimo dos esquemas `auth`, `storage` e `realtime`. Os testes rodam em `npm test` e no CI. Isso **não substitui** o teste no banco real, feito por `npm run test:rls` pela API pública.

### D-008 — Crédito do convidado desnormalizado em `guests`
- **Decisão:** `guests.church_id/group_id/member_id` guardam o crédito do primeiro cadastro, copiado do snapshot em `guest_referrals`. O cliente não pode alterar essas colunas (permissão por coluna); só RPCs auditadas.
- **Motivo:** políticas RLS simples e rápidas, sem `join` a cada linha.

### D-009 — Quem concede perfis
- **Decisão:** o Admin concede qualquer perfil. O Gestor de Igreja concede Gestor, Responsável de Grupo e Leitor **da própria igreja**; **não** concede Admin nem Recepção, porque a Recepção tem escopo em todas as igrejas.
- **Motivo:** menor privilégio; evita que um gestor amplie o próprio alcance.

### D-010 — Check-in também pelo Gestor de Igreja
- **Decisão:** Admin, Recepção e Gestor de Igreja operam o check-in. Na busca, o telefone aparece mascarado para todos.

### D-011 — Recepção e Leitor sem `select` direto em convidados
- **Decisão:** esses perfis não têm política de leitura em `guests`. A Recepção usa RPCs de check-in que já devolvem o telefone mascarado; o Leitor usa RPCs de números agregados.
- **Motivo:** a RLS é por linha e não mascara colunas; negar a tabela inteira é a forma segura.

### D-012 — Escritas sensíveis só por RPC
- **Decisão:** `attendances`, `guest_referrals`, `guest_consents`, `duplicate_reviews`, `goal_snapshots`, `member_group_history` e a inserção em `guests` não têm política de escrita para `authenticated`. São gravadas por funções `security definer` que validam o escopo.

### D-013 — Primeiro administrador
- **Decisão:** `public.bootstrap_polo_admin(email)` só pode ser executada pelo dono do banco (SQL Editor ou Supabase CLI), nunca pela API. O usuário é criado antes no painel do Auth. Assim nenhuma chave secreta passa pelo repositório.

### D-014 — Marcador de ambiente DEV
- **Decisão:** `app_settings.environment = 'dev'` é gravado apenas no projeto DEV (`npm run db:marcar-dev`, que confere o project ref). O seed de demonstração e o preparo dos testes de RLS abortam sem esse marcador, protegendo a produção.

### D-015 — Senha
- **Decisão:** mínimo de 8 caracteres com letras e números (validado no frontend e em `supabase/config.toml`).

### D-017 — Funções de escopo no schema `private`
- **Contexto:** o Supabase Advisor apontou 17 funções `security definer` chamáveis pela API.
- **Decisão:** as funções auxiliares (`is_polo_admin`, `has_church_access`, `has_group_access` etc.) foram movidas para o schema `private`, fora da API. Ficam em `public` só as RPCs intencionais: `can_grant_role` (usada pela Edge Function) e `list_manageable_users` (tela de usuários). Os dois avisos que restam são esperados.

### D-018 — Configuração de Auth do DEV mesclada
- **Contexto:** o Auth do DEV já tinha `site_url` e URLs de redirecionamento apontando para `trombetas-e-festas-sistema-interno-tf-cbc0.vercel.app`.
- **Decisão:** nenhuma URL existente foi removida. A `site_url` passou para `https://trombetas-e-festas-sistema-interno.vercel.app` (a URL informada pelo usuário e que responde 200), e o `-tf-cbc0` continua permitido como redirecionamento. API (`graphql_public`) e limite global de storage (50 MiB) ficaram como estavam no remoto.

### D-019 — Proteção contra senhas vazadas
- **Decisão:** o aviso `auth_leaked_password_protection` fica pendente: o recurso (verificação no Have I Been Pwned) só existe no plano Pro. Está na lista de configuração manual.

## Fase 3

### D-020 — Telas logadas verificadas pela API, não pelo navegador
- **Contexto:** fazer login no navegador exigiria digitar uma senha que seria enviada a um host externo (Supabase).
- **Decisão:** a lógica e as permissões das telas são validadas por testes de banco (PGlite) e por testes reais via API com usuários de perfis diferentes; no navegador verificam-se as telas públicas e o layout em 360 px. Os testes ponta a ponta com Playwright (Fase 9) rodam com usuários de teste.

### D-021 — Grupo não muda de igreja
- **Decisão:** um gatilho impede mudar `church_id` de um grupo. Para reorganizar, cria-se um novo grupo e transferem-se os membros (cada transferência fica no histórico).
- **Motivo:** preserva o histórico de metas e convites por igreja.

### D-022 — Contagens via RPC agregada
- **Decisão:** as telas de igrejas e grupos usam `church_overview()`/`group_overview()` em vez de contar linhas no cliente, para que o Leitor (sem acesso a membros) veja os totais e para não trafegar dados pessoais.

## Fase 4

### D-023 — Critério de possível duplicidade
- **Decisão:** vai para a fila de revisão quando, na mesma edição, outro convidado ativo tem o **mesmo telefone** (do convidado ou do responsável) **ou** nome com similaridade trigram ≥ 0,8. O motivo exibido distingue "mesmo telefone e nome parecido" (similaridade ≥ 0,5), "mesmo telefone, nome diferente (pode ser da mesma família)" e "nome muito parecido".
- **Motivo:** a especificação manda comparar telefone + similaridade de nome e não bloquear famílias; mostrar o motivo ajuda o revisor a decidir rápido.

### D-024 — Mescla
- **Decisão:** o revisor escolhe qual registro manter (dados). O crédito **sempre** vai para a indicação mais antiga, qualquer que seja o registro mantido. O registro descartado fica com `merged_into_id` e sai de todas as listas e estatísticas; indicações, consentimentos e presenças passam para o mantido. Se os dois tinham presença do mesmo tipo, a mais antiga continua ativa e a outra é revogada com o motivo "Mesclado".
- Para mesclar registros de igrejas diferentes, é preciso ter acesso às duas (na prática, o Admin).

### D-025 — Membro inativo não recebe novos convites
- **Decisão:** `create_guest` recusa membro inativo. Os convites anteriores continuam contando.

### D-026 — Cadastro rápido na ficha do membro
- **Decisão:** as 5 linhas pedem só nome, telefone, categoria, responsável (se menor) e consentimento; a situação do convite começa como "Convidado" e modalidade/transporte como "Indefinido", completáveis depois na ficha.

### D-027 — Exclusão de convidado
- **Decisão:** Admin, Gestor da igreja e Responsável do grupo podem excluir enquanto a edição estiver aberta, mas o banco impede excluir quem tem presença registrada (o histórico de presença nunca é apagado).

## Fase 5

### D-028 — Snapshot automático com pg_cron
- **Decisão:** um job `pg_cron` (`tef-snapshot-metas`, a cada minuto) grava o snapshot das edições cuja data de corte passou. Também é gravado ao salvar uma data de corte vencida, ao encerrar a edição e pelo botão do Admin. A situação dos membros é a do momento da gravação (até 1 minuto depois do corte).
- **Motivo:** o Postgres não guarda o histórico de "ativo/inativo"; gravar logo após o corte é o mais fiel possível.

### D-029 — "Membros abaixo da meta" considera só a base da meta
- **Decisão:** os indicadores "cumpriram/abaixo" contam apenas membros que fazem parte da meta (ativos ao vivo antes do corte, ou do snapshot depois). Membros novos após o corte (meta zero) não aparecem como "abaixo".

### D-030 — Alcance e online
- **Decisão:** `reach_total` = convidados com presença presencial + convidados só online. Quem tem as duas conta uma vez, como presencial. "Online confirmados" = situação "confirmou" com modalidade online; "online registrados" = presença online ativa (autodeclarada).

### D-031 — Grupo do snapshot
- **Decisão:** depois do corte, a meta de cada membro fica no grupo/igreja em que ele estava no snapshot, mesmo se for transferido. Os convites seguem o snapshot de `guest_referrals`.

## Fase 6

### D-032 — Canal de tempo real público, só com sinal
- **Decisão:** o banco publica em Broadcast público `tef-sinal` apenas `{tabela, em}`, sem nome, telefone ou id de convidado. Um canal privado exigiria políticas em `realtime.messages` sem ganho, já que o conteúdo não é sensível. Os dados são sempre buscados por RPC com RLS.

### D-033 — Recarga de segurança
- **Contexto:** num teste real, o primeiro sinal após abrir uma conexão nova se perdeu (as três execuções seguintes passaram).
- **Decisão:** o cliente recarrega tudo ao (re)conectar ao canal e recarrega os agregados a cada 60 s, independentemente do sinal. Assim uma mensagem perdida atrasa a tela em no máximo 1 minuto.

### D-034 — Erros que entram na fila offline
- **Decisão:** só falhas de rede (sem resposta do servidor) entram na fila. Erros de regra (sem permissão, evento encerrado) são mostrados na hora e não são reenviados. A fila desiste após 50 tentativas.

### D-035 — Busca do check-in
- **Decisão:** com 4 dígitos ou mais, a busca é pelo telefone (do convidado ou do responsável); senão, pelo nome normalizado (sem acento), por trecho ou similaridade trigram. No máximo 20 resultados, priorizando nomes que começam com o termo.

### D-036 — Modo offline completo
- **Pendência documentada (conforme a especificação):** a busca precisa de internet. Só o toque de "compareceu" e o cadastro na chegada ficam guardados quando a conexão cai.

## Fase 7

### D-037 — Gráficos sem biblioteca
- **Decisão:** barras, barra dividida e linha foram escritas em SVG/HTML (~300 linhas), com tooltip, legenda e alternativa em tabela. Evita +100 kB de biblioteca no celular da recepção.

### D-038 — Paleta dos gráficos
- **Decisão:** série 1 `#2a78d6` (azul) e série 2 `#eb6834` (laranja), slots 1–2 da paleta de referência, validados com `validate_palette.js` (CVD ΔE 24,7; visão normal 33,6; contraste ≥ 3:1). Barras de série única usam a série 1. Textos e números usam as cores de texto, nunca a da série. Azul-marinho e dourado ficam para a identidade (cartões e cabeçalho), não para dados.

### D-039 — Ranking por % de convites
- **Decisão:** os rankings ordenam pela % da meta de convites e mostram a presença no tooltip e na tabela. Grupos sem membros na meta ficam fora do ranking (a % seria indefinida), mas aparecem na tabela da igreja.

### D-040 — Painel por perfil
- **Decisão:** quem tem escopo do Polo vê o Polo; quem tem igreja vê a igreja (com seletor); o Responsável vê o painel de cada grupo seu. O banco aplica o mesmo escopo em todas as RPCs.

## Fase 8

### D-041 — CSV para o Excel brasileiro
- **Decisão:** separador `;`, UTF-8 com BOM, CRLF e telefones formatados `(83) 98765-4321`. Campos que começam com `= + - @` recebem apóstrofo (evita execução de fórmula ao abrir no Excel).

### D-042 — PDF pela impressão do navegador
- **Decisão:** "Imprimir / PDF" usa `window.print()` com CSS de impressão (sem menu, sem filtros, quebras de página que não cortam linhas). Evita uma biblioteca de PDF pesada no cliente; o usuário escolhe "Salvar como PDF".

### D-043 — Quando a exportação inclui telefone
- **Decisão:** Admin sempre; Gestor somente quando o filtro de igreja é uma igreja dele (assim a exportação não mistura igrejas). Responsável de Grupo exporta sem telefone, embora veja os telefones do grupo na tela (seção 4 × seção 14). O banco recusa registrar uma exportação com telefone fora dessas regras.

### D-044 — Relatórios com SECURITY INVOKER
- **Decisão:** `report_guests` e `transport_list` rodam com os privilégios de quem consulta, de modo que a própria RLS das tabelas decide as linhas. Recepção e Leitor recebem listas vazias e usam o relatório final, só com agregados.

### D-016 — Igreja nunca é excluída
- **Decisão:** não há política de delete em `churches`, e um gatilho impede a exclusão física mesmo pelo dono do banco.
