# Testes — o que foi executado e o resultado real

Só aparece como **aprovado** o que foi de fato executado. Itens da seção 19 ainda não executados ficam como **pendente**.

## Fase 1 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Lint | `npm run lint` (ESLint 9) | ✅ sem erros |
| Typecheck | `npm run typecheck` (tsc strict) | ✅ sem erros |
| Testes unitários | `npm test` (Vitest) — 4 arquivos, 25 testes: normalização/máscara de telefone (16), variáveis de ambiente (2), menu por perfil (4), rotas 404/privacidade/faixa de demonstração (3) | ✅ 25/25 |
| Build | `npm run build` | ✅ gerado em `dist/` |
| CI no GitHub Actions | workflow `ci.yml` após push | ver registro abaixo |

## Fase 2 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Migrations aplicam do zero | PGlite (Postgres 18) aplica as 7 migrations em sequência | ✅ |
| RLS e integridade | `npm run test:db`, 31 cenários: anônimo sem acesso; usuário sem perfil sem acesso; Gestor A não lê nem altera dados da igreja B; não cria membro fora da igreja; não altera crédito; não concede Admin/Recepção; Responsável vê só o grupo; Recepção e Leitor sem acesso a nomes e telefones; perfil desativado perde acesso; igreja não é excluída; último Admin protegido; evento ativo único; histórico de transferência; auditoria de permissões | ✅ 31/31 |
| Unitários de frontend | senha, tradução de erros, rotas (login exigido em rota protegida) | ✅ |
| Lint, typecheck, build | `npm run lint`, `npm run typecheck`, `npm run build` | ✅ |
| **RLS no banco real via API** | `npm run test:rls` no projeto DEV, com 6 usuários de teste (Admin, Gestor A, Responsável A1, Recepção, Leitor A, Leitor Polo) autenticados pela anon key: anônimo bloqueado; 11 igrejas; Gestor A não lê, não altera nem muda crédito na igreja B; não cria membro fora da igreja; não concede Admin; Responsável vê só o grupo; Recepção e Leitor sem nomes/telefones; Recepção não insere presença; funções internas inacessíveis; auditoria isolada por igreja | ✅ 15/15 |
| Edge Function `convidar-usuario` | mesmo script: Gestor não concede Admin (403); Responsável não convida (403); sem sessão (401); Gestor adiciona perfil a usuário existente (200, sem e-mail) e remove em seguida | ✅ 4/4 |
| Cadastro público bloqueado | `auth.signUp` com a anon key | ✅ recusado: "Signups not allowed for this instance" |
| Supabase Advisor | `supabase db advisors --remote` | ✅ restam 3 avisos esperados (2 RPCs públicas intencionais e proteção de senha vazada, que exige plano Pro) |
| Convite, recuperação e redefinição de senha | fluxo real com e-mail | ⏳ não executado: o SMTP padrão do Supabase só entrega para membros da equipe do projeto; depende do SMTP próprio |

## Fase 3 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Banco local (PGlite) | `supabase/tests/fase3-cadastros.test.ts`: nome de grupo único por igreja (sem diferenciar maiúsculas), mesmo nome em outra igreja permitido, grupo não muda de igreja, grupo inativo não recebe membro, Responsável cadastra sem informar igreja, Responsável bloqueado em outro grupo, inativação/reativação ajusta a data, transferência entre igrejas muda a igreja e grava histórico, histórico de outra igreja invisível, membro com convidado não pode ser excluído, visões agregadas por perfil, anônimo bloqueado | ✅ 19/19 |
| Banco real via API (DEV) | `npm run test:rls`: Leitor A vê só a igreja A; Leitor do Polo vê as 11; Responsável cadastra membro no grupo (igreja vem do grupo); Responsável bloqueado no grupo A2; Gestor transfere A1 → A2 com histórico; Gestor não move grupo para outra igreja | ✅ 25/25 (acumulado) |
| Interface | navegador local em 360 px: rota protegida redireciona ao login; sem erros no console | ✅ |
| Lint, typecheck, testes, build | — | ✅ 84 testes |

## Fase 4 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Banco local (PGlite) | `supabase/tests/fase4-convidados.test.ts`: snapshot igreja/grupo; consentimento com usuário e data; consentimento obrigatório; telefone obrigatório/válido; criança sem telefone com responsável e consentimento do responsável (art. 14); menor sem responsável recusado; online zera transporte; "precisa de transporte" cria e online cancela solicitação; limite de 500 caracteres; escopo (Responsável fora do grupo, Gestor de outra igreja, Recepção, Leitor); membro inativo; edição encerrada; telefone igual não bloqueia e vai para revisão; família com mesmo telefone; fila invisível ao Responsável; Responsável não mescla; mescla mantém crédito do **primeiro** cadastro mesmo mantendo o registro mais novo; registro mesclado não conta duas vezes; mescla auditada; "pessoas diferentes"; reatribuição exige justificativa e é auditada; Responsável não reatribui; transferência posterior do membro não muda o crédito | ✅ 24/24 |
| Frontend | validação do formulário (adulto, criança, consentimento, 500 caracteres) e rótulos | ✅ |
| Banco real via API (DEV) | `npm run test:rls`: cadastro com snapshot e consentimento; recusa sem consentimento; criança com responsável; Gestor A bloqueado para membro da igreja B; Recepção/Leitor bloqueados; duplicidade por telefone → revisão; fila invisível ao Responsável; Responsável não mescla; Gestor mescla com crédito do primeiro cadastro; dados de teste removidos ao final | ✅ 32/32 (acumulado) |

## Fase 5 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Fórmulas 20/30/50 | `supabase/tests/fase5-metas.test.ts`: 20 → 60/20; 30 → 90/30; 50 → 150/50 | ✅ |
| Percentuais e indicadores | 15 convidados/5 presentes sobre 150/50 → 10%/10%; membros que cumpriram (5) e abaixo (45); online separado do presencial; presencial+online conta uma vez no alcance; presença revogada não conta; transporte e confirmados | ✅ |
| Data de corte | antes do corte a meta é ao vivo; corte salvo no passado grava snapshot (50 membros); inativado depois do corte continua na meta; novo depois do corte tem meta zero e seus convites contam; transferência depois do corte mantém a meta no grupo do snapshot; só o Admin grava/refaz | ✅ 19/19 |
| Escopo | Leitor A vê só a igreja A; Gestor não vê o Polo; Leitor do Polo e Recepção veem; Leitor sem desempenho por membro; Responsável vê o próprio grupo | ✅ |
| pg_cron no banco real | edição de teste com corte vencido inserida sem o gatilho: snapshot gravado pelo job às 14:15 (2 membros), "succeeded"; edição removida em seguida | ✅ |
| Banco real via API | Leitor A (igreja A sim, Polo/igreja B não); fórmula da igreja A = ativos × 3 / × 1; Leitor do Polo vê o Polo e não vê membros; Responsável só o próprio grupo; Gestor não grava snapshot | ✅ 37/37 (acumulado) |

## Fase 6 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Banco local (PGlite) | `supabase/tests/fase6-checkin.test.ts`: busca por nome sem acento e por dígitos, telefone mascarado e nunca completo; Leitor/Responsável sem busca; registra com usuário; "já registrada" com hora e usuário; índice único bloqueia inserção direta; 10 chamadas "simultâneas" → 1 registro (no PGlite elas são serializadas; ver teste real abaixo); idempotência por `client_request_id`; Recepção e Gestor de outra igreja não desmarcam; motivo obrigatório; desmarcação mantém a linha; remarcar cria nova linha; auditoria marcar/desmarcar; online independente; walk-in com membro, sem membro (igreja obrigatória e fora das metas individuais), criança sem responsável recusada, walk-in idempotente, Responsável sem walk-in; sinal de tempo real sem dados pessoais | ✅ 25/25 |
| Fila offline | `offlineQueue.test.ts`: contador, reenvio em ordem, retentativa sem conexão, descarte em erro de regra, flush concorrente sem duplicar, limite de tentativas, detecção de erro de rede | ✅ 7/7 |
| **Corrida real** (DEV) | 12 chamadas `check_in` em paralelo, de 2 sessões (Recepção e Gestor), para o mesmo convidado | ✅ 1 "registrada", 11 "já registrada", 1 linha no banco |
| Banco real via API | máscara na busca; "já registrada" com hora/usuário; idempotência; Recepção não desmarca; Gestor desmarca com motivo e histórico; Leitor/Responsável sem check-in; online independente; walk-in sem membro exige igreja | ✅ |
| **Tempo real entre duas sessões** (DEV) | sessão do Gestor inscrita no canal; Recepção marca presença em outra sessão; sinal recebido sem nome/telefone | ⚠️ 1ª execução: o sinal não chegou em 15 s. Diagnóstico: canal e envio pelo banco funcionam (cliente anônimo recebeu). 3 execuções seguintes: ✅. Mitigação: D-033 e pausa de estabilização no teste |
| Acumulado `npm run test:rls` | — | ✅ 46/46 (3 execuções seguidas) |
| Interface do check-in no navegador | — | ⏳ não verificada logada (ver D-020); fluxo coberto pelas RPCs. Playwright na Fase 9 |

## Fase 7 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Banco local (PGlite) | `fase7-dashboards.test.ts`: evolução diária agrupada pelo dia de Fortaleza (cadastro às 23h30 do dia anterior fica no dia anterior); escopo do Leitor; categorias com presentes; transporte por igreja; Gestor A não vê transporte da igreja B | ✅ 5/5 |
| Frontend | dias curtos e preenchimento de dias sem movimento; conversão numérica preserva nomes | ✅ |
| Paleta | `validate_palette.js "#2a78d6,#eb6834" --mode light` | ✅ todas as checagens |
| Banco real via API | RPCs de painel respeitam o escopo (Leitor A); Admin vê 11 igrejas e os grupos; anônimo não executa nenhuma | ✅ 49/49 (acumulado) |
| Layout 360 px / tablet / desktop | — | ⏳ telas logadas serão capturadas pelo Playwright na Fase 9 |

## Fase 8 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| Banco local (PGlite) | `fase8-relatorios.test.ts`: filtros de presença, marcação especial e transporte; RLS no relatório (Gestor A só igreja A; Recepção e Leitor vazio); lista de transporte no escopo; Responsável atualiza transporte do grupo (auditado); Gestor A não altera transporte da igreja B; exportação com telefone do Gestor auditada; Responsável/Gestor de outra igreja/sem igreja recusados; Responsável exporta sem telefone | ✅ 9/9 |
| CSV | `csv.test.ts`: BOM, `;` e CRLF; aspas, `;` e quebras escapadas; fórmulas neutralizadas; booleanos/nulos; nome de arquivo sem acento | ✅ 5/5 |
| Banco real via API | relatório com RLS; exportação com telefone só Gestor/Admin e auditada; transporte no escopo | ✅ 52/52 (acumulado) |
| Impressão / PDF e abertura do CSV no Excel | — | ⏳ não verificado manualmente (sem Excel nesta máquina); o arquivo segue o formato testado acima. Impressão será capturada no Playwright (Fase 9) |

## Fase 9 — 2026-11-21

| Verificação | Como | Resultado |
|---|---|---|
| LGPD e auditoria (local) | `fase9-lgpd.test.ts`: só Admin localiza o titular; anonimizar remove nome/telefone e preserva presenças; a auditoria do convidado perde os dados pessoais; o log do pedido não guarda nome/telefone; exclusão remove convidado e presenças; justificativa obrigatória; retenção bloqueia edição ativa e antes do prazo; depois do prazo anonimiza tudo e preserva totais; Gestor não anonimiza; auditoria por escopo | ✅ 11/11 (somente PGlite) |
| LGPD no DEV | — | ⏳ **pendente** (pulado a pedido do usuário) |
| Seed de demonstração (DEV) | `npm run seed:demo` | ✅ 44 grupos, 880 membros, 3.000 convidados, 1.125 presenças, 200 online, 300 transportes |
| **Carga: busca do check-in** (DEV, 3.002 convidados) | `npm run test:carga`, perfil Recepção pela API | ✅ sequencial p50 311 ms / p95 461 ms; 20 simultâneas p50 726 ms / p95 926 ms (< 1 s). No banco, a consulta leva ~26 ms (8 ms de execução + 18 ms de planejamento); o restante é rede até a região do projeto |
| Revisão de segurança (DEV) | `revisao-seguranca.sql`: tabela sem RLS, anon com privilégio, definer sem `search_path`, definer executável por anon, funções internas expostas, schema `private` exposto, bucket público inesperado | ✅ nenhum problema encontrado |
| Supabase Advisor | `supabase db advisors --remote` | ⚠️ 28 avisos "função security definer executável por usuário logado": são as RPCs intencionais, cada uma valida o escopo e está coberta por testes. 1 aviso de proteção contra senhas vazadas (requer plano Pro) |
| Segredos no build | busca por `service_role`, `sb_secret_` e JWT no `dist/` | ✅ nenhum (a única ocorrência de `sb_secret_` é o código da biblioteca que verifica prefixos) |
| E2E (Playwright) | `e2e/fluxos.spec.ts` | ⏳ **não executado** (interrompido a pedido do usuário) |

## Situação da seção 19 da especificação

| # | Teste | Situação |
|---|---|---|
| 1 | Login, convite, recuperação e redefinição de senha | ✅ login por senha via API; convite sem e-mail via Edge Function; primeiro Admin cadastrado no DEV; ⏳ e-mails de convite e recuperação (dependem de SMTP próprio) |
| 2 | Seed das 11 igrejas | ✅ local e no banco real (DEV) |
| 3 | CRUD de grupos e membros, transferência | ✅ local e via API no banco real; telas logadas não verificadas no navegador (ver D-020) |
| 4 | Cadastro de convidados, criança com responsável | ✅ local e via API no banco real |
| 5 | Duplicidade, mescla, crédito do primeiro cadastro | ✅ local e via API no banco real |
| 6 | Metas 20/30/50 e data de corte | ✅ local; fórmula e escopo também via API no banco real; snapshot automático confirmado no DEV |
| 7 | Check-in, duplicada, corrida concorrente | ✅ local e no banco real (12 requisições paralelas) |
| 8 | Desmarcação com histórico; Recepção impedida | ✅ local e via API no banco real |
| 9 | Online separado do presencial | ✅ local (metas e check-in) e via API |
| 10 | Tempo real entre duas sessões | ✅ via API no banco real (1 falha intermitente na 1ª execução, ver Fase 6) |
| 11 | RLS via API | ✅ local (PGlite) e via API no banco real (15 cenários; ampliado nas próximas fases) |
| 12 | CSV e impressão | ✅ geração do CSV e regras de exportação (local e API); ⏳ abertura no Excel e impressão não verificadas visualmente |
| 13 | Layout 360 px / tablet / desktop | ⏳ pendente: só a tela de login foi verificada em 360 px; telas logadas dependiam do Playwright |
| 14 | Carga: 3.000 convidados, busca < 1 s | ✅ p95 461 ms (sequencial) e 926 ms (20 simultâneas) no DEV |
