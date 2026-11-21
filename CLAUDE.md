# CLAUDE.md — regras permanentes do projeto

Sistema de Gestão **Trombetas e Festas** — Igreja Cristã Maranata, Polo Torre.
A especificação oficial é [docs/PROMPT_MESTRE.md](docs/PROMPT_MESTRE.md) e **prevalece sobre qualquer suposição**.

## Ao iniciar ou retomar uma sessão
1. Leia [docs/PROGRESSO.md](docs/PROGRESSO.md) e continue da primeira fase não concluída.
2. Leia [docs/DECISOES.md](docs/DECISOES.md) antes de decidir algo já discutido.

## Modo de trabalho: autônomo
- Executar as fases 1 a 10 (seção 20 da especificação) em sequência, sem esperar aprovação entre elas.
- Só interromper o usuário quando for impossível seguir sem ele (login no navegador, senha, chave).
- Qualquer outra dúvida: escolher a opção mais segura e coerente com a especificação, registrar em `docs/DECISOES.md` e seguir.
- A cada fase: implementar por completo → `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` até passar →
  (Fase 2+) testar RLS contra o banco real com usuários de perfis diferentes → atualizar `CHANGELOG.md`,
  `docs/DECISOES.md`, `docs/TESTES.md` (resultado **real**) e `docs/PROGRESSO.md` → commits descritivos em português → push na `main`.
- Nunca declarar como pronto ou aprovado algo que não foi executado de fato.

## Stack
- Frontend: React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + componentes no padrão shadcn/ui (`src/components/ui`).
- Estado de servidor: TanStack Query. Formulários: react-hook-form + zod. Ícones: lucide-react. Avisos: sonner.
- Backend: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions). Migrations em `supabase/migrations/`
  (Supabase CLI, `npx supabase db push`). Tipos: `npx supabase gen types typescript` → `src/lib/database.types.ts`.
- Hospedagem: Vercel (push na `main` publica). CI: GitHub Actions (`.github/workflows/ci.yml`).
- Testes: Vitest (lógica), scripts SQL/API com usuários de teste (RLS), Playwright (fluxos principais).
- Supabase DEV: `zaawhfbmuogfyigxscta` (pode receber seed de demonstração). Produção: projeto separado, **nunca** rodar seed fictício.

## Segurança (inegociável)
- **Nunca** usar, pedir ou commitar a `service_role` no frontend. Nenhuma variável `VITE_*` pode conter segredo.
- Nunca commitar `.env*` (só `.env.example`). Nunca inventar credenciais.
- RLS habilitado em **todas** as tabelas, com políticas para select/insert/update/delete. Esconder botão não é controle de acesso.
- Checagens de escopo em funções SQL `security definer` reutilizáveis: `is_polo_admin()`, `has_church_access(church_id)`,
  `has_group_access(group_id)` etc. Toda função `security definer` define `search_path` fixo.
- Sem cadastro público: usuários entram somente por convite.
- Telefones mascarados para Recepção e Leitor; Leitor não vê nomes nem telefones de convidados.
- Realtime só como sinal de "algo mudou" — nunca transmitir linhas com dados pessoais.

## Regras de negócio críticas
### Convidados (seção 8)
- Todo convidado nasce de um membro. Igreja e grupo **não são digitados**: são copiados do membro e gravados como
  snapshot em `guest_referrals` (`member_id`, `church_id`, `group_id`, `created_at`).
- Telefone obrigatório (exceto Criança/Adolescente, que usam o do responsável legal), normalizado em E.164 (`+5583...`).
- Criança/Adolescente exigem responsável legal (nome e telefone); o consentimento é do responsável (LGPD art. 14).
- Consentimento obrigatório, gravando data, hora e usuário.
- Modalidade Online → transporte oculto e zerado. "Confirmou presença" + Online = participação online (fora das métricas presenciais).
- Observações opcionais, até 500 caracteres.
- Duplicidade: telefone normalizado + similaridade de nome (`pg_trgm`). Telefone igual **não bloqueia**; marca
  "possível duplicidade" e envia à fila de revisão (mesclar ou "pessoas diferentes").
- **Crédito:** fica com o **primeiro cadastro** (`created_at`). Reatribuição manual só com justificativa auditada.
- Um convidado **nunca** conta duas vezes em nenhuma estatística.

### Motor de metas (seção 10)
- Meta de convites = membros ativos × meta por membro (padrão 3). Meta presencial = membros ativos × meta (padrão 1).
- % convites = convidados únicos ÷ meta de convites × 100. % presença = convidados únicos com check-in presencial ÷ meta presencial × 100.
- Validar: 20 membros → 60/20; 30 → 90/30; 50 → 150/50.
- Antes da data de corte: membros ativos ao vivo. Na data de corte: snapshot em `goal_snapshots`; depois, a meta usa o snapshot
  (inativados depois do corte continuam na meta; novos entram com meta zero, mas seus convites contam).
- Inativar/transferir membro **nunca** apaga convites nem presenças. Convites contam para igreja/grupo do snapshot.
- Cálculos **no banco** (views/funções SQL), nunca no frontend.

### Check-in (seção 11)
- `attendances` com índice único parcial `(event_id, guest_id, type) where revoked_at is null`.
- Marcar presença = RPC atômica e idempotente; corrida concorrente → um sucesso, o outro recebe "já registrada" (com hora e usuário).
- Desmarcar: só Gestor de Igreja ou Admin, motivo obrigatório, soft revoke (nunca apagar a linha). Recepção **não** desmarca.
- Online (`type='online'`) é autodeclarado e **nunca** somado ao presencial; quem tem os dois conta só como presencial no alcance.
- Fila local de retentativa (IndexedDB) com contador "X check-ins aguardando envio", usando a mesma RPC idempotente.
- Walk-in: "Sem membro identificado" entra nos totais do Polo/igreja, não nas metas individuais.

### Multievento (seção 2)
- Convidados, convites, presenças, transporte e metas pertencem a um `event_id`. Apenas um evento `ativo` por vez;
  evento `encerrado` é somente leitura.

## Convenções
- Interface, mensagens, e-mails, commits e documentação em **português brasileiro**.
- Datas em `timestamptz`, exibidas em `America/Fortaleza`.
- Identificadores de código e banco em inglês (`guests`, `church_id`); textos de tela em português.
- Alias `@/` → `src/`. Componentes de UI em `src/components/ui`, layout em `src/components/layout`,
  funcionalidades em `src/features/<domínio>`, páginas em `src/pages`.
- Botões com alvo mínimo de 44 px; mobile-first no check-in e no cadastro de convidado.
- Estados de carregamento (skeleton), estados vazios com orientação e erros em português claro.
- Commits pequenos e descritivos em português (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
