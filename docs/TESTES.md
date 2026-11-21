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

## Situação da seção 19 da especificação

| # | Teste | Situação |
|---|---|---|
| 1 | Login, convite, recuperação e redefinição de senha | ✅ login por senha via API; convite sem e-mail via Edge Function; ⏳ e-mails de convite e recuperação (dependem de SMTP próprio) |
| 2 | Seed das 11 igrejas | ✅ local e no banco real (DEV) |
| 3 | CRUD de grupos e membros, transferência | ✅ local e via API no banco real; telas logadas não verificadas no navegador (ver D-020) |
| 4 | Cadastro de convidados, criança com responsável | ✅ local e via API no banco real |
| 5 | Duplicidade, mescla, crédito do primeiro cadastro | ✅ local e via API no banco real |
| 6 | Metas 20/30/50 e data de corte | ✅ local; fórmula e escopo também via API no banco real; snapshot automático confirmado no DEV |
| 7 | Check-in, duplicada, corrida concorrente | pendente (Fase 6) |
| 8 | Desmarcação com histórico; Recepção impedida | pendente (Fase 6) |
| 9 | Online separado do presencial | pendente (Fase 6) |
| 10 | Tempo real entre duas sessões | pendente (Fase 6) |
| 11 | RLS via API | ✅ local (PGlite) e via API no banco real (15 cenários; ampliado nas próximas fases) |
| 12 | CSV e impressão | pendente (Fase 8) |
| 13 | Layout 360 px / tablet / desktop | pendente (Fase 7) |
| 14 | Carga: 3.000 convidados, busca < 1 s | pendente (Fase 9) |
