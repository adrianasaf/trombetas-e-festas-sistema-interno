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

## Situação da seção 19 da especificação

| # | Teste | Situação |
|---|---|---|
| 1 | Login, convite, recuperação e redefinição de senha | pendente (Fase 2) |
| 2 | Seed das 11 igrejas | pendente (Fase 2) |
| 3 | CRUD de grupos e membros, transferência | pendente (Fase 3) |
| 4 | Cadastro de convidados, criança com responsável | pendente (Fase 4) |
| 5 | Duplicidade, mescla, crédito do primeiro cadastro | pendente (Fase 4) |
| 6 | Metas 20/30/50 e data de corte | pendente (Fase 5) |
| 7 | Check-in, duplicada, corrida concorrente | pendente (Fase 6) |
| 8 | Desmarcação com histórico; Recepção impedida | pendente (Fase 6) |
| 9 | Online separado do presencial | pendente (Fase 6) |
| 10 | Tempo real entre duas sessões | pendente (Fase 6) |
| 11 | RLS via API | pendente (Fase 2+) |
| 12 | CSV e impressão | pendente (Fase 8) |
| 13 | Layout 360 px / tablet / desktop | pendente (Fase 7) |
| 14 | Carga: 3.000 convidados, busca < 1 s | pendente (Fase 9) |
